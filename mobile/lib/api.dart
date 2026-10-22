import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Addresses of the same server, comma-separated: flutter build apk --dart-define=SERVER=https://...,http://...
/// https on 443 gets through mobile networks and DPI best; the bare IP keeps working when DNS for the domain fails.
final kServers = const String.fromEnvironment('SERVER', defaultValue: 'https://188-120-246-113.sslip.io,http://188.120.246.113:8787')
    .split(',')
    .map((s) => s.trim().replaceAll(RegExp(r'/+$'), ''))
    .where((s) => s.isNotEmpty)
    .toList();

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

  /// sign-in providers the server has keys for (vk, google, apple)
  List<String> providers = const ['vk', 'google', 'apple'];

  /// VK ID app id and Google web client id: with them Android signs in through the VK app / the system account picker
  String vkClientId = '';
  String googleClientId = '';
  String _base = kServers.first;
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
    final base = p.getString('base');
    if (base != null && kServers.contains(base)) _base = base;
    providers = p.getStringList('providers') ?? providers;
    vkClientId = p.getString('vkClientId') ?? '';
    googleClientId = p.getString('googleClientId') ?? '';
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

  // Direct connection fails fast (4 s to connect) so a blocked route doesn't stall every request;
  // idle connections live for a minute: a fresh TCP+TLS handshake costs seconds on a bad mobile network
  final _http = IOClient(HttpClient()
    ..connectionTimeout = const Duration(seconds: 4)
    ..idleTimeout = const Duration(seconds: 60));

  // direct vs relay: decided by a background probe, remembered between launches
  bool? _direct;
  Future<bool>? _probing;
  DateTime _probed = DateTime(2000);
  // all addresses race, the first one that answers wins
  Future<bool> _probe() => _probing ??= () async {
        final won = Completer<String?>();
        var left = kServers.length;
        for (final s in kServers) {
          _http.get(Uri.parse('$s/api/health')).timeout(const Duration(seconds: 5)).then((r) {
            if (r.statusCode != 200) throw const HttpException('health');
            final j = jsonDecode(r.body) as Json;
            final ps = (j['providers'] as List?)?.cast<String>();
            if (ps != null && ps.isNotEmpty) providers = ps;
            vkClientId = (j['vkClientId'] ?? '') as String;
            googleClientId = (j['googleClientId'] ?? '') as String;
            if (!won.isCompleted) won.complete(s);
          }).catchError((_) {
            if (--left == 0 && !won.isCompleted) won.complete(null);
          });
        }
        final s = await won.future;
        if (s != null) _base = s;
        _direct = s != null || kRelay.isEmpty;
        _probed = DateTime.now();
        _probing = null;
        final p = await SharedPreferences.getInstance();
        await p.setString('route', _direct! ? 'direct' : 'relay');
        await p.setString('base', _base);
        await p.setStringList('providers', providers);
        await p.setString('vkClientId', vkClientId);
        await p.setString('googleClientId', googleClientId);
        return _direct!;
      }();
  Future<bool> _useDirect() async {
    if (_direct == null) return _probe();
    // the direct route is being re-checked (app start, network change): some networks let the TCP handshake
    // through and then drop everything, so a request sent there now could hang until the timeout
    if (_direct! && _probing != null) return _probing!;
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
  // request and the first answer wins. Writes are never duplicated (sign-in by tag is safe to repeat),
  // they get one retry on failure.
  Future<http.Response> _viaRelay(String method, String path, String? b) async {
    final payload = jsonEncode({'api': {'m': method, 'p': path, 'k': token, 'b': b == null ? null : jsonDecode(b)}});
    if (method != 'GET' && path != '/auth/tag') return _relayOnce(payload).catchError((_) => _relayOnce(payload));
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

  static bool _netError(Object e) => e is SocketException || e is HttpException || e is http.ClientException || e is HandshakeException;

  Future<dynamic> req(String method, String path, [Object? body]) async {
    final headers = {'content-type': 'application/json', if (token != null) 'authorization': 'Bearer $token'};
    final b = body == null ? null : jsonEncode(body);
    // a read that gets no answer is a dead route rather than a slow server (long polls are held up to 25 s);
    // writes may run long on the server (AI, search start) and can't be safely resent
    final wait = method != 'GET' ? 60 : path.contains('wait=') ? 35 : 15;
    Future<http.Response> direct() => _send(method, Uri.parse('$_base/api$path'), headers, b).timeout(Duration(seconds: wait));
    bool deadRoute(Object e) => _netError(e) || (e is TimeoutException && (method == 'GET' || path == '/auth/tag'));
    http.Response r;
    try {
      if (await _useDirect()) {
        try {
          try {
            r = await direct();
          } catch (e) {
            // a dropped connection on a flaky network: one quick retry for reads
            if (method != 'GET' || !_netError(e)) rethrow;
            await Future.delayed(const Duration(milliseconds: 800));
            r = await direct();
          }
        } catch (e) {
          if (!deadRoute(e)) rethrow;
          // the route just broke (VPN switched on, network changed): try the other addresses, else the relay
          _direct = null;
          r = await _probe() ? await direct() : await _viaRelay(method, path, b).timeout(const Duration(seconds: 60));
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

  // ---- sign-in by tag: the tag is bound to this phone, other devices can't use it ----
  static const _device = MethodChannel('hotelkino/device');

  /// ANDROID_ID survives reinstalling the app; a random key kept in settings when it's unavailable
  Future<String> _deviceId() async {
    try {
      final id = await _device.invokeMethod<String>('id');
      if (id != null && id.isNotEmpty) return 'android:$id';
    } catch (_) {}
    final p = await SharedPreferences.getInstance();
    var key = p.getString('deviceKey');
    if (key == null) {
      final r = Random.secure();
      key = List.generate(32, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
      await p.setString('deviceKey', key);
    }
    return 'key:$key';
  }

  Future<void> loginTag(String tag) async =>
      _signedIn(await req('POST', '/auth/tag', {'tag': tag, 'deviceId': await _deviceId(), 'device': 'Android'}) as Json);

  // ---- sign-in with VK ID / Google / Apple (off for now, see kOAuthLogin): the provider page opens in the browser, the app polls ----
  Future<Json> loginStart(String provider) async => await req('POST', '/auth/start', {'provider': provider, 'device': 'Android'}) as Json;

  /// 'pending' while the user is still in the browser, 'ok' once signed in; throws ApiError when sign-in failed
  Future<String> loginPoll(String code) async {
    final r = await req('GET', '/auth/poll?code=$code') as Json;
    final status = r['status'] as String;
    if (status == 'error' || status == 'expired') throw ApiError((r['error'] ?? 'Вход не завершён, попробуйте ещё раз') as String, 400);
    if (status != 'ok') return status;
    await _signedIn(r);
    return status;
  }

  Future<void> _signedIn(Json r) async {
    token = r['token'];
    user = r['user'];
    city = (user?['city'] ?? '') as String;
    await _save();
  }

  /// the VK app returned an authorization code for the sign-in [state] started with [loginStart]
  Future<void> loginVkCode(String state, String code, String deviceId) async =>
      _signedIn(await req('POST', '/auth/vk/code', {'state': state, 'code': code, 'deviceId': deviceId}) as Json);

  /// an ID token from the Android account picker, issued to [googleClientId]
  Future<void> loginGoogleToken(String idToken) async =>
      _signedIn(await req('POST', '/auth/google/token', {'idToken': idToken, 'device': 'Android'}) as Json);

  // ---- the Telegram bot is linked after sign-in ----
  Future<Json> linkTelegram() async {
    final r = await req('POST', '/link/telegram') as Json;
    bot = (r['bot'] ?? bot) as String;
    return r;
  }

  Future<void> unlinkTelegram() async {
    await req('DELETE', '/link/telegram');
    await refreshMe();
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
