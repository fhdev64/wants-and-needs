import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Server address is baked in at build time: flutter build apk --dart-define=SERVER=https://...
const kServer = String.fromEnvironment('SERVER', defaultValue: 'http://10.0.2.2:8787');

/// Fallback route (Google Apps Script, server/deploy/tg-relay.gs). Some VPN exits can't reach
/// Russian hosting at all, while Google is reachable both with and without a VPN.
const kRelay = String.fromEnvironment('RELAY',
    defaultValue: 'https://script.google.com/macros/s/AKfycbwUT1HkVtJAN3v0aFr4EDNXbSxioRX4eip14RxOJ4ELEDTNzIEE2K_ozUUK-iZDmKLZiw/exec');

class ApiError implements Exception {
  final String message;
  final int status;
  ApiError(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

typedef Json = Map<String, dynamic>;

/// Thin client: wishlists, search and AI keys live on the server.
class Api {
  Api._();
  static final Api i = Api._();

  String? token;
  Json? user;
  String city = '';
  String bot = 'hotelkinobot';
  final _authLost = StreamController<void>.broadcast();
  Stream<void> get onAuthLost => _authLost.stream;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    token = p.getString('token');
    // test builds only: --dart-define=DEV_TOKEN=... skips the Telegram login
    const devToken = String.fromEnvironment('DEV_TOKEN');
    if (token == null && devToken.isNotEmpty) token = devToken;
    city = p.getString('city') ?? '';
    final u = p.getString('user');
    if (u != null) user = jsonDecode(u) as Json;
    // start from the route that worked last time and re-check it in the background
    final route = p.getString('route');
    if (route != null) _direct = route == 'direct';
    unawaited(_probe());
  }

  Future<void> _save() async {
    final p = await SharedPreferences.getInstance();
    if (token == null) {
      await p.remove('token');
    } else {
      await p.setString('token', token!);
    }
    await p.setString('city', city);
    if (user != null) await p.setString('user', jsonEncode(user));
  }

  // Direct connection fails fast (3 s to connect) so a blocked route doesn't stall every request
  final _http = IOClient(HttpClient()..connectionTimeout = const Duration(seconds: 3));

  // direct vs relay: decided by a background probe, remembered between launches
  bool? _direct;
  Future<bool>? _probing;
  DateTime _probed = DateTime(2000);
  Future<bool> _probe() => _probing ??= () async {
        bool ok;
        try {
          final r = await _http.get(Uri.parse('$kServer/api/health')).timeout(const Duration(seconds: 4));
          ok = r.statusCode == 200;
        } catch (_) {
          ok = false;
        }
        _direct = ok || kRelay.isEmpty;
        _probed = DateTime.now();
        _probing = null;
        (await SharedPreferences.getInstance()).setString('route', _direct! ? 'direct' : 'relay');
        return _direct!;
      }();
  Future<bool> _useDirect() async {
    if (_direct == null) return _probe();
    // while on the slow route, look for the direct one again now and then
    if (!_direct! && DateTime.now().difference(_probed) > const Duration(minutes: 2)) unawaited(_probe());
    return _direct!;
  }

  Future<http.Response> _relayOnce(String payload) async {
    var r = await http.post(Uri.parse(kRelay), headers: {'content-type': 'application/json'}, body: payload);
    // Apps Script answers POST with a redirect to the result
    if (r.statusCode == 302 && r.headers['location'] != null) r = await http.get(Uri.parse(r.headers['location']!));
    final j = jsonDecode(utf8.decode(r.bodyBytes));
    if (j is! Map || j['status'] == null) throw const FormatException('relay');
    return http.Response.bytes(utf8.encode(jsonEncode(j['body'])), j['status'] as int);
  }

  // Apps Script latency is erratic (2 s … 40 s): a GET that hasn't answered in 3 s gets a twin
  // request and the first answer wins. Writes are never duplicated, they get one retry on failure.
  Future<http.Response> _viaRelay(String method, String path, String? b) async {
    final payload = jsonEncode({'api': {'m': method, 'p': path, 'k': token, 'b': b == null ? null : jsonDecode(b)}});
    if (method != 'GET') return _relayOnce(payload).catchError((_) => _relayOnce(payload));
    final done = Completer<http.Response>();
    var failed = 0;
    void run() => _relayOnce(payload).then((r) {
          if (!done.isCompleted) done.complete(r);
        }, onError: (Object e) {
          if (++failed == 2 && !done.isCompleted) done.completeError(e);
        });
    run();
    Future.delayed(Duration(seconds: path.contains('wait=') ? 25 : 3), () {
      if (!done.isCompleted) run();
    });
    return done.future;
  }

  Future<http.Response> _send(String method, Uri uri, Map<String, String> headers, String? b) => switch (method) {
        'GET' => _http.get(uri, headers: headers),
        'POST' => _http.post(uri, headers: headers, body: b),
        'PUT' => _http.put(uri, headers: headers, body: b),
        'DELETE' => _http.delete(uri, headers: headers),
        _ => throw ArgumentError(method),
      };

  Future<dynamic> req(String method, String path, [Object? body]) async {
    final uri = Uri.parse('$kServer/api$path');
    final headers = {'content-type': 'application/json', if (token != null) 'authorization': 'Bearer $token'};
    final b = body == null ? null : jsonEncode(body);
    http.Response r;
    try {
      if (await _useDirect()) {
        try {
          r = await _send(method, uri, headers, b).timeout(const Duration(seconds: 60));
        } on SocketException {
          // the direct route just broke (VPN switched on, network changed): finish this request via the relay
          if (kRelay.isEmpty) rethrow;
          _direct = false;
          _probed = DateTime.now();
          r = await _viaRelay(method, path, b).timeout(const Duration(seconds: 60));
        }
      } else {
        r = await _viaRelay(method, path, b).timeout(const Duration(seconds: 60));
      }
    } on TimeoutException {
      throw ApiError('Сервер долго не отвечает');
    } catch (_) {
      _direct = null;
      throw ApiError('Нет связи с сервером. Проверьте интернет.');
    }
    final data = r.body.isEmpty ? null : jsonDecode(utf8.decode(r.bodyBytes));
    if (r.statusCode == 401 && token != null) {
      await logout(remote: false);
      _authLost.add(null);
    }
    if (r.statusCode >= 400) throw ApiError((data is Map ? data['error'] : null) ?? 'Ошибка ${r.statusCode}', r.statusCode);
    return data;
  }

  // ---- auth via Telegram bot ----
  Future<Json> loginStart() async {
    final r = await req('POST', '/auth/start', {'device': 'Android'}) as Json;
    bot = r['bot'] ?? bot;
    return r;
  }

  /// returns true when the user confirmed the login in the bot
  Future<bool> loginPoll(String code) async {
    final r = await req('GET', '/auth/poll?code=$code') as Json;
    if (r['status'] != 'ok') return false;
    token = r['token'];
    user = r['user'];
    city = (user?['city'] ?? '') as String;
    await _save();
    return true;
  }

  Future<void> logout({bool remote = true}) async {
    if (remote) await req('POST', '/auth/logout').catchError((_) => null);
    token = null;
    user = null;
    await _save();
  }

  Future<void> refreshMe() async {
    final u = await req('GET', '/me') as Json;
    user = u;
    city = (u['city'] ?? '') as String;
    bot = (u['bot'] ?? bot) as String;
    await _save();
  }

  Future<void> setCity(String c) async {
    city = c;
    await _save();
    await req('PUT', '/me', {'city': c});
  }

  // ---- wishlist & search ----
  Future<List<Json>> items() async => ((await req('GET', '/items')) as List).cast<Json>();
  Future<void> deleteItem(String id) => req('DELETE', '/items/$id');
  Future<Json> setDone(String id, bool done) async => await req('PUT', '/items/$id', {'done': done}) as Json;
  Future<Json> setTarget(String id, int? target) async => await req('PUT', '/items/$id', {'target': target}) as Json;
  Future<List<Json>> alerts({int since = 0}) async => ((await req('GET', '/alerts?since=$since')) as List).cast<Json>();
  Future<void> markAlertsSeen() => req('POST', '/alerts/seen');
  Future<Json> saveItem(String jobId, Json meta) async => await req('POST', '/items', {'jobId': jobId, ...meta}) as Json;
  Future<Json> refreshItem(String id) async => await req('POST', '/items/$id/refresh') as Json;
  Future<List<Json>> identify({String query = '', String? image}) async =>
      (((await req('POST', '/identify', {'query': query, 'image': image})) as Json)['candidates'] as List).cast<Json>();
  Future<Json> search(String name) async => await req('POST', '/search', {'name': name, 'city': city}) as Json;
  Future<Json> job(String id, {int? after}) async =>
      await req('GET', after == null ? '/search/$id' : '/search/$id?after=$after&wait=20') as Json;

  /// Follows a search job until it is done, emitting every update. Long poll: the server holds
  /// each request until there is news, so a slow route costs one round trip per update.
  Stream<Json> watch(Json job) async* {
    yield job;
    var j = job;
    var fails = 0;
    while (j['done'] != true) {
      try {
        j = await this.job(j['id'], after: (j['rev'] ?? 0) as int);
        fails = 0;
        yield j;
      } on ApiError catch (e) {
        if (e.status == 404 || ++fails >= 3) rethrow;
        await Future.delayed(const Duration(seconds: 2));
      }
    }
  }
}
