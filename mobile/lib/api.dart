import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Server address is baked in at build time: flutter build apk --dart-define=SERVER=https://...
const kServer = String.fromEnvironment('SERVER', defaultValue: 'http://10.0.2.2:8787');

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
    city = p.getString('city') ?? '';
    final u = p.getString('user');
    if (u != null) user = jsonDecode(u) as Json;
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

  Future<dynamic> req(String method, String path, [Object? body]) async {
    final uri = Uri.parse('$kServer/api$path');
    final headers = {'content-type': 'application/json', if (token != null) 'authorization': 'Bearer $token'};
    http.Response r;
    try {
      final b = body == null ? null : jsonEncode(body);
      r = await switch (method) {
        'GET' => http.get(uri, headers: headers),
        'POST' => http.post(uri, headers: headers, body: b),
        'PUT' => http.put(uri, headers: headers, body: b),
        'DELETE' => http.delete(uri, headers: headers),
        _ => throw ArgumentError(method),
      }.timeout(const Duration(seconds: 60));
    } on TimeoutException {
      throw ApiError('Сервер долго не отвечает');
    } catch (_) {
      throw ApiError('Сервер недоступен. Проверьте интернет.');
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
  Future<Json> saveItem(String jobId, Json meta) async => await req('POST', '/items', {'jobId': jobId, ...meta}) as Json;
  Future<Json> refreshItem(String id) async => await req('POST', '/items/$id/refresh') as Json;
  Future<List<Json>> identify({String query = '', String? image}) async =>
      (((await req('POST', '/identify', {'query': query, 'image': image})) as Json)['candidates'] as List).cast<Json>();
  Future<Json> search(String name) async => await req('POST', '/search', {'name': name, 'city': city}) as Json;
  Future<Json> job(String id) async => await req('GET', '/search/$id') as Json;

  /// Polls a search job until it is done, emitting every update.
  Stream<Json> watch(Json job) async* {
    yield job;
    var j = job;
    while (j['done'] != true) {
      await Future.delayed(const Duration(milliseconds: 1500));
      j = await this.job(j['id']);
      yield j;
    }
  }
}
