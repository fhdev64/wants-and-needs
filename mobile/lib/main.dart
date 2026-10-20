import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'product.dart';
import 'ui.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    systemNavigationBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  await Api.i.load();
  runApp(const HotelkiApp());
}

class HotelkiApp extends StatefulWidget {
  const HotelkiApp({super.key});
  @override
  State<HotelkiApp> createState() => _HotelkiAppState();
}

class _HotelkiAppState extends State<HotelkiApp> {
  late final StreamSubscription _lost = Api.i.onAuthLost.listen((_) => setState(() {}));
  @override
  void dispose() {
    _lost.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Хотелки',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.transparent,
        colorScheme: const ColorScheme.dark(primary: C.blue, surface: C.base),
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
        textTheme: ThemeData.dark().textTheme.apply(bodyColor: C.label, displayColor: C.label),
      ),
      builder: (context, child) => MediaQuery.withClampedTextScaling(maxScaleFactor: 1.25, child: Wallpaper(child: child!)),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 500),
        child: Api.i.token == null ? LoginScreen(key: const ValueKey('login'), onDone: () => setState(() {})) : HomeScreen(key: const ValueKey('home'), onLogout: () => setState(() {})),
      ),
    );
  }
}

// ======================= Login via Telegram =======================
class LoginScreen extends StatefulWidget {
  final VoidCallback onDone;
  const LoginScreen({super.key, required this.onDone});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with WidgetsBindingObserver {
  bool _waiting = false;
  String? _code;
  Timer? _poll;
  DateTime? _until;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    super.dispose();
  }

  // returning from Telegram: check immediately instead of waiting for the next tick
  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s == AppLifecycleState.resumed && _code != null) _check();
  }

  Future<void> _start() async {
    setState(() => _waiting = true);
    try {
      final r = await Api.i.loginStart();
      _code = r['code'];
      _until = DateTime.now().add(Duration(seconds: r['expiresIn'] ?? 600));
      final tgApp = Uri.parse('tg://resolve?domain=${r['bot']}&start=login_${r['code']}');
      if (!await launchUrl(tgApp, mode: LaunchMode.externalApplication)) {
        await launchUrl(Uri.parse(r['url']), mode: LaunchMode.externalApplication);
      }
      _poll?.cancel();
      _poll = Timer.periodic(const Duration(seconds: 2), (_) => _check());
    } catch (e) {
      if (mounted) {
        setState(() => _waiting = false);
        toast(context, e.toString());
      }
    }
  }

  Future<void> _check() async {
    if (_code == null) return;
    if (_until != null && DateTime.now().isAfter(_until!)) {
      _poll?.cancel();
      _code = null;
      if (mounted) {
        setState(() => _waiting = false);
        toast(context, 'Время вышло, попробуйте ещё раз');
      }
      return;
    }
    try {
      if (await Api.i.loginPoll(_code!)) {
        _poll?.cancel();
        HapticFeedback.mediumImpact();
        widget.onDone();
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 900),
              curve: spring,
              builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1), child: Transform.translate(offset: Offset(0, 30 * (1 - v)), child: child)),
              child: Glass(
                radius: 34,
                padding: const EdgeInsets.fromLTRB(28, 40, 28, 28),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(26),
                      gradient: const LinearGradient(colors: [Color(0x38FFFFFF), Color(0x0FFFFFFF)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      border: const Border(top: BorderSide(color: Color(0x66FFFFFF))),
                    ),
                    child: const Icon(Icons.favorite_border_rounded, size: 42, color: Colors.white),
                  ),
                  const SizedBox(height: 18),
                  const Text('Хотелки', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: -.8)),
                  const SizedBox(height: 10),
                  const Text('Список желаний и лучшие цены\nна Авито, Ozon, WB и в магазинах', textAlign: TextAlign.center, style: TextStyle(fontSize: 15.5, height: 1.45, color: C.label2)),
                  const SizedBox(height: 30),
                  Btn(_waiting ? 'Жду подтверждения…' : 'Войти через Telegram', icon: Icons.send_rounded, big: true, color: C.tg, busy: _waiting && _code == null, onTap: _waiting ? null : _start),
                  AnimatedSize(
                    duration: const Duration(milliseconds: 400),
                    curve: spring,
                    child: _waiting && _code != null
                        ? Padding(
                            padding: const EdgeInsets.only(top: 16),
                            child: Column(children: [
                              const Text('Нажмите «Войти» в боте и вернитесь сюда', textAlign: TextAlign.center, style: TextStyle(color: C.label2, fontSize: 14)),
                              TextButton(onPressed: _start, child: const Text('Открыть Telegram ещё раз', style: TextStyle(color: C.teal))),
                            ]),
                          )
                        : const SizedBox(width: double.infinity),
                  ),
                  const SizedBox(height: 14),
                  Text('Откроется бот @${Api.i.bot}.\nХотелки общие для бота, компьютера и телефона.', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12.5, height: 1.5, color: C.label3)),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ======================= Home: tabs =======================
class HomeScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const HomeScreen({super.key, required this.onLogout});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  final _listKey = GlobalKey<WishlistScreenState>();

  @override
  void initState() {
    super.initState();
    Api.i.refreshMe().then((_) => mounted ? setState(() {}) : null).catchError((_) {});
  }

  void _openAdd() async {
    await Navigator.of(context).push(glassRoute(const AddScreen()));
    _listKey.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      extendBody: true,
      body: Stack(children: [
        IndexedStack(index: _tab, children: [
          WishlistScreen(key: _listKey, onAdd: _openAdd),
          ProfileScreen(onLogout: widget.onLogout),
        ]),
        const ScrollEdge(),
      ]),
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 14),
        child: Row(children: [
          Expanded(
            child: Glass(
              radius: 32,
              padding: const EdgeInsets.all(6),
              blur: 30,
              tint: const Color(0x66283240),
              child: SizedBox(
                height: 52,
                child: LayoutBuilder(builder: (_, cs) {
                  final w = cs.maxWidth / 2;
                  return Stack(children: [
                    // glass droplet that slides between tabs
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 550),
                      curve: spring,
                      left: w * _tab,
                      width: w,
                      top: 0,
                      bottom: 0,
                      child: Container(decoration: BoxDecoration(color: const Color(0x24FFFFFF), borderRadius: BorderRadius.circular(26), border: const Border(top: BorderSide(color: Color(0x40FFFFFF), width: .8)))),
                    ),
                    Positioned.fill(
                      child: Row(children: [
                        _tabBtn(0, Icons.favorite_rounded, 'Хотелки'),
                        _tabBtn(1, Icons.person_rounded, 'Профиль'),
                      ]),
                    ),
                  ]);
                }),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // the primary action lives on its own, like Apple's search/compose button
          Semantics(
            label: 'Добавить хотелку',
            button: true,
            child: Press(
              onTap: _openAdd,
              scale: .9,
              child: Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(color: C.blue.withValues(alpha: .92), shape: BoxShape.circle, border: const Border(top: BorderSide(color: Color(0x59FFFFFF)))),
                child: const Icon(Icons.add_rounded, size: 34, color: Colors.white),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _tabBtn(int i, IconData icon, String label) => Expanded(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            setState(() => _tab = i);
          },
          child: Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.center, children: [
            Icon(icon, size: 22, color: _tab == i ? C.label : C.label2),
            const SizedBox(width: 8),
            Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.fade, softWrap: false, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: _tab == i ? C.label : C.label2))),
          ]),
        ),
      );
}

// ======================= Wishlist =======================
class WishlistScreen extends StatefulWidget {
  final VoidCallback onAdd;
  const WishlistScreen({super.key, required this.onAdd});
  @override
  State<WishlistScreen> createState() => WishlistScreenState();
}

class WishlistScreenState extends State<WishlistScreen> {
  List<Json>? _items;
  String? _error;
  String _q = '';
  String _sort = 'date';

  @override
  void initState() {
    super.initState();
    reload();
  }

  Future<void> reload() async {
    try {
      final list = await Api.i.items();
      if (mounted) setState(() { _items = list; _error = null; });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  List<Json> get _visible {
    final q = _q.trim().toLowerCase();
    final l = (_items ?? []).where((i) => q.isEmpty || '${i['name']} ${i['brand'] ?? ''}'.toLowerCase().contains(q)).toList();
    num p(Json i, num d) => (i['minPrice'] as num?) ?? d;
    if (_sort == 'cheap') l.sort((a, b) => p(a, 1e15).compareTo(p(b, 1e15)));
    if (_sort == 'exp') l.sort((a, b) => p(b, -1).compareTo(p(a, -1)));
    return l;
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final items = _visible;
    return RefreshIndicator(
      onRefresh: reload,
      color: C.label,
      backgroundColor: const Color(0xFF1E2630),
      edgeOffset: top + 60,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, top + 14, 20, 6),
              child: Row(children: [
                const Expanded(child: Text('Мои хотелки', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: -.8))),
                if ((_items ?? []).isNotEmpty)
                  PopupMenuButton<String>(
                    tooltip: 'Сортировка',
                    color: const Color(0xF21E2630),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    onSelected: (v) => setState(() => _sort = v),
                    itemBuilder: (_) => [
                      for (final (k, l, ic) in [('date', 'Сначала новые', Icons.schedule_rounded), ('cheap', 'Сначала дешёвые', Icons.south_rounded), ('exp', 'Сначала дорогие', Icons.north_rounded)])
                        PopupMenuItem(value: k, child: Row(children: [Icon(ic, size: 20), const SizedBox(width: 12), Text(l), const Spacer(), if (_sort == k) const Icon(Icons.check_rounded, size: 20, color: C.blue)])),
                    ],
                    child: const IgnorePointer(child: IconBtn(Icons.swap_vert_rounded, tooltip: 'Сортировка')),
                  ),
              ]),
            ),
          ),
          if ((_items ?? []).length > 3)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 4),
                child: Glass(
                  radius: 24,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  blur: 20,
                  child: TextField(
                    onChanged: (v) => setState(() => _q = v),
                    style: const TextStyle(fontSize: 16),
                    decoration: const InputDecoration(border: InputBorder.none, hintText: 'Поиск', hintStyle: TextStyle(color: C.label3), icon: Icon(Icons.search_rounded, color: C.label2)),
                  ),
                ),
              ),
            ),
          if (_items == null && _error == null)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: C.label)))
          else if (_error != null && _items == null)
            SliverFillRemaining(child: _Empty(icon: Icons.cloud_off_rounded, title: 'Нет связи', text: _error!, action: Btn('Повторить', icon: Icons.refresh_rounded, onTap: reload)))
          else if (items.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _Empty(
                icon: Icons.favorite_border_rounded,
                title: _q.isEmpty ? 'Хотелок пока нет' : 'Ничего не найдено',
                text: _q.isEmpty ? 'Сфотографируйте товар или введите название — найдём цены на Авито, Ozon, WB и в магазинах.' : 'Нет хотелок по запросу «$_q»',
                action: _q.isEmpty ? Btn('Добавить хотелку', icon: Icons.add_rounded, prominent: true, big: true, onTap: widget.onAdd) : null,
              ),
            )
          else
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 12, 16, 120 + MediaQuery.paddingOf(context).bottom),
              sliver: SliverList.separated(
                itemCount: (items.length + 1) ~/ 2,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (_, r) => IntrinsicHeight(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Expanded(child: _ItemCard(item: items[r * 2], index: r * 2, onChanged: reload)),
                    const SizedBox(width: 14),
                    Expanded(child: r * 2 + 1 < items.length ? _ItemCard(item: items[r * 2 + 1], index: r * 2 + 1, onChanged: reload) : const SizedBox()),
                  ]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  final Json item;
  final int index;
  final VoidCallback onChanged;
  const _ItemCard({required this.item, required this.index, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final n = (item['offers'] as List?)?.length ?? 0;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 500 + index * 50),
      curve: spring,
      builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1), child: Transform.translate(offset: Offset(0, 24 * (1 - v)), child: child)),
      child: Press(
        onTap: () async {
          await Navigator.of(context).push(glassRoute(ProductScreen(saved: item)));
          onChanged();
        },
        child: Glass(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Hero(tag: 'img-${item['id']}', child: ProductImage(url: item['image'], name: item['name'] ?? '', height: 130)),
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(item['name'] ?? '', maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.25)),
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(n > 0 ? '$n ${plural(n, 'предложение', 'предложения', 'предложений')}' : (item['brand'] ?? ''), maxLines: 1, style: const TextStyle(fontSize: 12.5, color: C.label2)),
            ),
            const Spacer(),
            const SizedBox(height: 12),
            FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: PriceCapsule(item['minPrice'] as num?, prefix: 'от')),
          ]),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  final IconData icon;
  final String title, text;
  final Widget? action;
  const _Empty({required this.icon, required this.title, required this.text, this.action});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(32, 0, 32, 120),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 64, color: C.label3),
          const SizedBox(height: 14),
          Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, height: 1.45, color: C.label2)),
          if (action != null) ...[const SizedBox(height: 22), action!],
        ]),
      );
}

// ======================= Profile =======================
const kCities = ['Вся Россия', 'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону', 'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар', 'Саратов', 'Тюмень', 'Ижевск', 'Барнаул', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Томск', 'Калининград', 'Сочи'];

Future<void> pickCity(BuildContext context, VoidCallback onDone) async {
  final ctrl = TextEditingController();
  final picked = await showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
      child: Glass(
        radius: 34,
        tint: const Color(0xD91A212B),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
        child: SizedBox(
          height: MediaQuery.sizeOf(ctx).height * .7,
          child: Column(children: [
            Container(width: 40, height: 5, decoration: BoxDecoration(color: C.label3, borderRadius: BorderRadius.circular(3))),
            const SizedBox(height: 14),
            const Text('Ваш город', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(color: const Color(0x33000000), borderRadius: BorderRadius.circular(18)),
              child: TextField(
                controller: ctrl,
                textInputAction: TextInputAction.done,
                onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
                style: const TextStyle(fontSize: 16),
                decoration: const InputDecoration(border: InputBorder.none, hintText: 'Другой город — введите и нажмите Enter', hintStyle: TextStyle(color: C.label3)),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView(children: [
                for (final c in kCities)
                  ListTile(
                    minTileHeight: 52,
                    title: Text(c, style: const TextStyle(fontSize: 16.5)),
                    trailing: (c == 'Вся Россия' ? Api.i.city.isEmpty : Api.i.city == c) ? const Icon(Icons.check_rounded, color: C.blue) : null,
                    onTap: () => Navigator.pop(ctx, c),
                  ),
              ]),
            ),
          ]),
        ),
      ),
    ),
  );
  if (picked == null) return;
  try {
    await Api.i.setCity(picked == 'Вся Россия' ? '' : picked);
    onDone();
  } catch (e) {
    if (context.mounted) toast(context, e.toString());
  }
}

class ProfileScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const ProfileScreen({super.key, required this.onLogout});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final u = Api.i.user ?? {};
    final name = (u['name'] ?? 'Пользователь') as String;
    final top = MediaQuery.paddingOf(context).top;
    Widget row(IconData ic, String title, String value, VoidCallback onTap) => Press(
          onTap: onTap,
          scale: .98,
          child: SizedBox(
            height: 60,
            child: Row(children: [
              const SizedBox(width: 6),
              Icon(ic, color: C.teal),
              const SizedBox(width: 14),
              Expanded(child: Text(title, style: const TextStyle(fontSize: 16.5))),
              Text(value, style: const TextStyle(fontSize: 15, color: C.label2)),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right_rounded, color: C.label3),
            ]),
          ),
        );
    return ListView(
      padding: EdgeInsets.fromLTRB(20, top + 14, 20, 140),
      children: [
        const Text('Профиль', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, letterSpacing: -.8)),
        const SizedBox(height: 18),
        Glass(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Container(
              width: 60,
              height: 60,
              alignment: Alignment.center,
              decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [C.tg, Color(0xFF5E5CE6)])),
              child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                Text([if (u['username'] != null && u['username'] != '') '@${u['username']}', 'Telegram'].join(' · '), style: const TextStyle(color: C.label2)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 22),
        const Padding(padding: EdgeInsets.only(left: 6, bottom: 8), child: Text('Поиск', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
        Glass(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: row(Icons.place_rounded, 'Город', Api.i.city.isEmpty ? 'Вся Россия' : Api.i.city, () => pickCity(context, () => setState(() {}))),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: Text('Объявления Авито ищутся в этом городе, а для магазинов учитываются самовывоз и доставка. Город общий с ботом.', style: TextStyle(fontSize: 13, height: 1.45, color: C.label2)),
        ),
        const SizedBox(height: 22),
        const Padding(padding: EdgeInsets.only(left: 6, bottom: 8), child: Text('Телеграм-бот', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700))),
        Glass(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: row(Icons.send_rounded, 'Открыть бота', '@${Api.i.bot}', () => launchUrl(Uri.parse('https://t.me/${Api.i.bot}'), mode: LaunchMode.externalApplication)),
        ),
        const Padding(
          padding: EdgeInsets.fromLTRB(8, 8, 8, 0),
          child: Text('В боте можно просто написать название товара или прислать фото — хотелка появится и здесь.', style: TextStyle(fontSize: 13, height: 1.45, color: C.label2)),
        ),
        const SizedBox(height: 30),
        Btn('Выйти', icon: Icons.logout_rounded, color: C.red.withValues(alpha: .22), onTap: () async {
          await Api.i.logout();
          widget.onLogout();
        }),
      ],
    );
  }
}
