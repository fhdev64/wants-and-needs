import 'dart:io';
import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

import 'api.dart';

/// Branded system notifications: ✦ status-bar icon, electric-blue accent,
/// large product photo, old → new price. Checked in the background every hour.
final _fln = FlutterLocalNotificationsPlugin();

/// itemId of a tapped notification, consumed by the home screen
final ValueNotifier<String?> openItemRequest = ValueNotifier(null);

const _channel = AndroidNotificationChannel(
  'prices',
  'Цены',
  description: 'Снижение цен и достижение целевой цены',
  importance: Importance.high,
);

Future<void> initNotifications({bool requestPermission = true}) async {
  await _fln.initialize(
    settings: const InitializationSettings(android: AndroidInitializationSettings('ic_stat_star')),
    onDidReceiveNotificationResponse: (r) => openItemRequest.value = r.payload,
  );
  final android = _fln.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
  await android?.createNotificationChannel(_channel);
  if (requestPermission) await android?.requestNotificationsPermission();
  final launch = await _fln.getNotificationAppLaunchDetails();
  if (launch?.didNotificationLaunchApp == true) openItemRequest.value = launch!.notificationResponse?.payload;
}

String _rub(num? n) {
  if (n == null) return '—';
  final s = n.round().toString(), b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return '$b ₽';
}

Future<String?> _download(String url) async {
  try {
    final r = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 15));
    if (r.statusCode != 200 || r.bodyBytes.length < 500) return null;
    final f = File('${(await getTemporaryDirectory()).path}/alert_${url.hashCode}.img');
    await f.writeAsBytes(r.bodyBytes);
    return f.path;
  } catch (_) {
    return null;
  }
}

Future<void> showAlert(Json a) async {
  final target = a['kind'] == 'target';
  // the product name leads (titles get cut short on most phones); the deal goes first in the body
  final title = '${target ? '🎯' : '📉'} ${a['name']}';
  final prices = a['oldPrice'] != null && a['oldPrice'] != a['newPrice'] ? '${_rub(a['oldPrice'])} → ${_rub(a['newPrice'])}' : _rub(a['newPrice']);
  final lead = target ? 'Цель достигнута' : '−${a['pct']}%';
  final body = [lead, prices, if ((a['store'] ?? '').toString().isNotEmpty) a['store']].join(' · ');
  final img = (a['image'] ?? '').toString().startsWith('https://') ? await _download(a['image']) : null;

  final details = AndroidNotificationDetails(
    _channel.id,
    _channel.name,
    channelDescription: _channel.description,
    importance: Importance.high,
    priority: Priority.high,
    icon: 'ic_stat_star',
    color: const Color(0xFF2F5BFF),
    subText: 'хотелкино ✦',
    category: AndroidNotificationCategory.recommendation,
    largeIcon: img != null ? FilePathAndroidBitmap(img) : null,
    styleInformation: img != null
        ? BigPictureStyleInformation(FilePathAndroidBitmap(img), contentTitle: title, summaryText: body, hideExpandedLargeIcon: true)
        : BigTextStyleInformation(body, contentTitle: title),
  );
  await _fln.show(id: (a['id'] ?? '').hashCode & 0x7fffffff, title: title, body: body, notificationDetails: NotificationDetails(android: details), payload: a['itemId']);
}

/// fetches alerts newer than the last check and shows them; the first run only sets the baseline
Future<List<Json>> pollAlerts({bool show = true}) async {
  if (Api.i.token == null) return [];
  final p = await SharedPreferences.getInstance();
  final since = p.getInt('alertsSince');
  final list = await Api.i.alerts(since: since ?? 0);
  final newest = list.fold<int>(since ?? 0, (m, a) => (a['created'] as int) > m ? a['created'] as int : m);
  await p.setInt('alertsSince', since == null ? DateTime.now().millisecondsSinceEpoch : newest);
  if (since == null || !show) return list;
  for (final a in list.take(3)) {
    await showAlert(a);
  }
  return list;
}

@pragma('vm:entry-point')
void notificationWorker() {
  Workmanager().executeTask((task, input) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    try {
      await Api.i.load();
      await initNotifications(requestPermission: false);
      await pollAlerts();
    } catch (_) {}
    return true;
  });
}

Future<void> startBackgroundChecks() async {
  await Workmanager().initialize(notificationWorker);
  await Workmanager().registerPeriodicTask('price-alerts', 'price-alerts',
      frequency: const Duration(hours: 1), constraints: Constraints(networkType: NetworkType.connected), existingWorkPolicy: ExistingPeriodicWorkPolicy.keep);
}
