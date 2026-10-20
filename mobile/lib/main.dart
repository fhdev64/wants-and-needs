import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'product.dart';
import 'ui.dart';

const kAppName = 'хотелкино ✦︎';

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
    final base = ThemeData.dark();
    return MaterialApp(
      title: kAppName,
      debugShowCheckedModeBanner: false,
      theme: base.copyWith(
        scaffoldBackgroundColor: Colors.transparent,
        colorScheme: const ColorScheme.dark(primary: C.blue, surface: C.base),
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
        textTheme: base.textTheme.apply(fontFamily: kFont, bodyColor: C.label, displayColor: C.label),
        textSelectionTheme: const TextSelectionThemeData(cursorColor: C.blue, selectionColor: Color(0x662F5BFF)),
      ),
      builder: (context, child) => MediaQuery.withClampedTextScaling(maxScaleFactor: 1.25, child: Wallpaper(child: child!)),
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 500),
        child: Api.i.token == null ? LoginScreen(key: const ValueKey('login'), onDone: () => setState(() {})) : HomeScreen(key: const ValueKey('home'), onLogout: () => setState(() {})),
      ),
    );
  }
}

/// brand mark: the ✦ star in a blue glass tile
class Logo extends StatelessWidget {
  final double size;
  const Logo({super.key, this.size = 84});
  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(size * .3),
          gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF3B66FF), Color(0xFF1A2FB8), Color(0xFF0E1440)]),
          boxShadow: const [BoxShadow(color: Color(0x802F5BFF), blurRadius: 40, offset: Offset(0, 12))],
          border: Border.all(color: const Color(0x33FFFFFF)),
        ),
        alignment: Alignment.center,
        child: Text('✦', style: TextStyle(fontSize: size * .5, color: Colors.white, height: 1)),
      );
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
      if (mounted) setState(() {});
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
    final pad = MediaQuery.paddingOf(context);
    return Scaffold(
      body: Padding(
        padding: EdgeInsets.fromLTRB(24, pad.top + 24, 24, pad.bottom + 24),
        child: Column(children: [
          const Spacer(flex: 3),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: 1),
            duration: const Duration(milliseconds: 900),
            curve: spring,
            builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1), child: Transform.scale(scale: .85 + .15 * v, child: child)),
            child: const Logo(size: 96),
          ),
          const SizedBox(height: 28),
          const Text(kAppName, style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -1)),
          const SizedBox(height: 12),
          const Text('Список желаний и лучшие цены\nна Авито, Ozon, WB и в магазинах', textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.45, color: C.label2)),
          const Spacer(flex: 4),
          if (_waiting && _code != null) ...[
            Glass(
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.2, color: C.price)),
                const SizedBox(width: 14),
                const Expanded(child: Text('Нажмите «Войти» в боте и вернитесь сюда', style: TextStyle(fontSize: 14.5, color: C.label2))),
                TextButton(onPressed: _start, child: const Text('Ещё раз', style: TextStyle(color: C.price, fontWeight: FontWeight.w700))),
              ]),
            ),
            const SizedBox(height: 14),
          ],
          SizedBox(
            width: double.infinity,
            child: Btn(_waiting && _code != null ? 'Открыть Telegram' : 'Войти через Telegram', icon: Icons.send_rounded, big: true, arrow: true, kind: BtnKind.primary, busy: _waiting && _code == null, onTap: _start),
          ),
          const SizedBox(height: 16),
          Text('Откроется бот @${Api.i.bot} — нажмите в нём «Войти».\nХотелки общие для бота, компьютера и телефона.', textAlign: TextAlign.center, style: const TextStyle(fontSize: 12.5, height: 1.5, color: C.label3)),
        ]),
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
          ProfileScreen(onLogout: widget.onLogout, onAdd: _openAdd, onOpenList: () => setState(() => _tab = 0)),
        ]),
        const ScrollEdge(),
      ]),
      // reference-style dock: icons, the active one expands into a labelled pill
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, bottom + 12),
        child: Glass(
          radius: 34,
          padding: const EdgeInsets.all(6),
          tint: const Color(0xE6151821),
          // fixed height: Center inside the add button would otherwise take the whole screen
          child: SizedBox(
            height: 54,
            child: Row(children: [
              _tabBtn(0, Icons.favorite_rounded, 'Хотелки'),
              _addBtn(),
              _tabBtn(1, Icons.person_rounded, 'Профиль'),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _tabBtn(int i, IconData icon, String label) {
    final on = _tab == i;
    return Expanded(
      flex: on ? 5 : 3,
      child: Press(
        onTap: () => setState(() => _tab = i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 450),
          curve: spring,
          height: 54,
          decoration: BoxDecoration(color: on ? const Color(0x24FFFFFF) : Colors.transparent, borderRadius: BorderRadius.circular(28), border: Border.all(color: on ? const Color(0x1FFFFFFF) : Colors.transparent)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 23, color: on ? C.label : C.label3),
            if (on) ...[
              const SizedBox(width: 8),
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.fade, softWrap: false, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700))),
            ],
          ]),
        ),
      ),
    );
  }

  Widget _addBtn() => Expanded(
        flex: 3,
        child: Semantics(
          label: 'Добавить хотелку',
          button: true,
          child: Press(
            onTap: _openAdd,
            scale: .9,
            child: Center(
              child: Container(
                width: 54,
                height: 54,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(colors: [Color(0xFF3B66FF), Color(0xFF1A3BF0)]),
                  boxShadow: [BoxShadow(color: Color(0x802F5BFF), blurRadius: 18, offset: Offset(0, 6))],
                ),
                child: const Icon(Icons.add_rounded, size: 30, color: Colors.white),
              ),
            ),
          ),
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
  String _done = 'active';

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
    final l = (_items ?? []).where((i) => (q.isEmpty || '${i['name']} ${i['brand'] ?? ''}'.toLowerCase().contains(q)) && (_done == 'all' || (_done == 'done') == (i['done'] == true))).toList();
    num p(Json i, num d) => (i['minPrice'] as num?) ?? d;
    if (_sort == 'cheap') l.sort((a, b) => p(a, 1e15).compareTo(p(b, 1e15)));
    if (_sort == 'exp') l.sort((a, b) => p(b, -1).compareTo(p(a, -1)));
    return l;
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    final items = _visible;
    final all = _items ?? [];
    final active = all.where((i) => i['done'] != true).toList();
    final total = active.fold<num>(0, (s, i) => s + ((i['minPrice'] as num?) ?? 0));
    final doneN = all.length - active.length;
    return RefreshIndicator(
      onRefresh: reload,
      color: C.label,
      backgroundColor: C.panel2,
      edgeOffset: top + 60,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, top + 16, 20, 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Eyebrow('хотелкино ✦', color: C.gold),
                const SizedBox(height: 6),
                const Text('Мои хотелки', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -.8)),
                if (all.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  // total of active wishes, like the balance card in the reference
                  Glass(
                    radius: 24,
                    padding: const EdgeInsets.all(18),
                    gradient: kBlueCard,
                    child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Eyebrow('всё вместе от', color: Color(0xB3FFFFFF)),
                          const SizedBox(height: 4),
                          FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(rub(total), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w800))),
                        ]),
                      ),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text('${active.length} ${plural(active.length, 'активная', 'активные', 'активных')}', style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text('✓ исполнено $doneN', style: const TextStyle(color: C.green, fontWeight: FontWeight.w700)),
                      ]),
                    ]),
                  ),
                ],
              ]),
            ),
          ),
          if (all.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 14, 0, 4),
                child: Chips(
                  items: const [('active', 'Активные'), ('done', 'Исполненные'), ('all', 'Все')],
                  value: _done,
                  counts: {'active': active.length, 'done': doneN, 'all': all.length},
                  onChanged: (v) => setState(() => _done = v),
                ),
              ),
            ),
          if (all.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 0, 0),
                child: Chips(items: const [('date', 'Новые'), ('cheap', 'Дешевле'), ('exp', 'Дороже')], value: _sort, onChanged: (v) => setState(() => _sort = v)),
              ),
            ),
          if (all.length > 3)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(color: C.fill, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0x14FFFFFF))),
                  child: TextField(
                    onChanged: (v) => setState(() => _q = v),
                    style: const TextStyle(fontSize: 16),
                    decoration: const InputDecoration(border: InputBorder.none, hintText: 'Поиск по хотелкам', hintStyle: TextStyle(color: C.label3), icon: Icon(Icons.search_rounded, color: C.label2)),
                  ),
                ),
              ),
            ),
          if (_items == null && _error == null)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: C.price)))
          else if (_error != null && _items == null)
            SliverFillRemaining(child: _Empty(icon: Icons.cloud_off_rounded, title: 'Нет связи', text: _error!, action: Btn('Повторить', icon: Icons.refresh_rounded, onTap: reload)))
          else if (items.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: _Empty(
                icon: Icons.auto_awesome_rounded,
                title: _q.isEmpty ? (_done == 'done' && all.isNotEmpty ? 'Пока ничего не исполнено' : 'Хотелок пока нет') : 'Ничего не найдено',
                text: _q.isEmpty ? 'Сфотографируйте товар или введите название — найдём цены на Авито, Ozon, WB и в магазинах.' : 'Нет хотелок по запросу «$_q»',
                action: _q.isEmpty && all.isEmpty ? Btn('Добавить хотелку', icon: Icons.add_rounded, kind: BtnKind.primary, big: true, onTap: widget.onAdd) : null,
              ),
            )
          else
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 14, 16, 130 + MediaQuery.paddingOf(context).bottom),
              sliver: SliverList.separated(
                itemCount: (items.length + 1) ~/ 2,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (_, r) => IntrinsicHeight(
                  child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    Expanded(child: _ItemCard(item: items[r * 2], index: r * 2, onChanged: reload)),
                    const SizedBox(width: 12),
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
    final done = item['done'] == true;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 500 + index * 50),
      curve: spring,
      builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1) * (done ? .55 : 1), child: Transform.translate(offset: Offset(0, 24 * (1 - v)), child: child)),
      child: Press(
        onTap: () async {
          await Navigator.of(context).push(glassRoute(ProductScreen(saved: item)));
          onChanged();
        },
        child: Glass(
          radius: 22,
          padding: const EdgeInsets.all(8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Stack(children: [
              Hero(tag: 'img-${item['id']}', child: ProductImage(url: item['image'], name: item['name'] ?? '', height: 132, radius: 16)),
              if (n > 0 || done)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xCC0B0D14), borderRadius: BorderRadius.circular(10)),
                    child: Text(done ? '✓ ИСПОЛНЕНО' : '$n ПРЕДЛ.', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: .6, color: done ? C.green : C.gold)),
                  ),
                ),
            ]),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 10, 6, 6),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Eyebrow((item['brand'] ?? '').toString().isEmpty ? 'товар' : item['brand']),
                const SizedBox(height: 3),
                Text(item['name'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, height: 1.25)),
              ]),
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 2, 6, 4),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text.rich(TextSpan(children: [
                  const TextSpan(text: 'от ', style: TextStyle(fontSize: 12.5, color: C.label2, fontWeight: FontWeight.w600)),
                  TextSpan(text: rub(item['minPrice'] as num?), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: C.price)),
                ])),
              ),
            ),
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
        padding: const EdgeInsets.fromLTRB(32, 0, 32, 130),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 60, color: C.price.withValues(alpha: .6)),
          const SizedBox(height: 14),
          Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(text, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, height: 1.45, color: C.label2)),
          if (action != null) ...[const SizedBox(height: 24), action!],
        ]),
      );
}

// ======================= Profile =======================
const kCities = ['Вся Россия', 'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону', 'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар', 'Саратов', 'Тюмень', 'Ижевск', 'Барнаул', 'Иркутск', 'Хабаровск', 'Ярославль', 'Владивосток', 'Томск', 'Калининград', 'Сочи'];

Future<void> pickCity(BuildContext context, VoidCallback onDone) async {
  final ctrl = TextEditingController();
  final picked = await glassSheet<String>(
    context,
    (ctx) => SizedBox(
      height: MediaQuery.sizeOf(ctx).height * .68,
      child: Column(children: [
        Container(width: 40, height: 5, decoration: BoxDecoration(color: const Color(0x4DFFFFFF), borderRadius: BorderRadius.circular(3))),
        const SizedBox(height: 16),
        Row(children: [
          const Expanded(child: Text('Ваш город', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
          IconBtn(Icons.close_rounded, tooltip: 'Закрыть', size: 40, onTap: () => Navigator.pop(ctx)),
        ]),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: const Color(0x33000000), borderRadius: BorderRadius.circular(20)),
          child: TextField(
            controller: ctrl,
            textInputAction: TextInputAction.done,
            onSubmitted: (v) => Navigator.pop(ctx, v.trim()),
            style: const TextStyle(fontSize: 16),
            decoration: const InputDecoration(border: InputBorder.none, hintText: 'Другой город — введите и нажмите Enter', hintStyle: TextStyle(color: C.label3)),
          ),
        ),
        const SizedBox(height: 6),
        Expanded(
          child: ListView(children: [
            for (final c in kCities)
              ListTile(
                minTileHeight: 52,
                contentPadding: const EdgeInsets.symmetric(horizontal: 6),
                title: Text(c, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w600)),
                trailing: (c == 'Вся Россия' ? Api.i.city.isEmpty : Api.i.city == c) ? const Icon(Icons.check_circle_rounded, color: C.price) : null,
                onTap: () => Navigator.pop(ctx, c),
              ),
          ]),
        ),
      ]),
    ),
  );
  if (picked == null || picked.isEmpty) return;
  try {
    await Api.i.setCity(picked == 'Вся Россия' ? '' : picked);
    onDone();
  } catch (e) {
    if (context.mounted) toast(context, e.toString());
  }
}

class ProfileScreen extends StatefulWidget {
  final VoidCallback onLogout, onAdd, onOpenList;
  const ProfileScreen({super.key, required this.onLogout, required this.onAdd, required this.onOpenList});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final u = Api.i.user ?? {};
    final name = (u['name'] ?? 'Пользователь') as String;
    final count = (u['count'] ?? 0) as int;
    final top = MediaQuery.paddingOf(context).top;
    Widget row(IconData ic, String title, String sub, VoidCallback onTap, {Color? color}) => Press(
          onTap: onTap,
          scale: .98,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(children: [
              Container(width: 42, height: 42, decoration: BoxDecoration(color: C.fill, borderRadius: BorderRadius.circular(14)), child: Icon(ic, color: color ?? C.label, size: 21)),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color ?? C.label)),
                  Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: C.label2)),
                ]),
              ),
              Icon(Icons.arrow_forward_rounded, color: color ?? C.label2),
            ]),
          ),
        );
    return ListView(
      padding: EdgeInsets.fromLTRB(20, top + 16, 20, 150),
      physics: const BouncingScrollPhysics(),
      children: [
        Row(children: [
          const Expanded(child: Text('Профиль', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, letterSpacing: -.8))),
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: LinearGradient(colors: [C.tg, C.blue])),
            child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          ),
        ]),
        Text([name, if ((u['username'] ?? '') != '') '@${u['username']}'].join(' · '), style: const TextStyle(color: C.label2, fontSize: 14)),
        const SizedBox(height: 18),
        // blue summary card, like the balance card in the reference
        Glass(
          radius: 26,
          padding: const EdgeInsets.all(18),
          gradient: kBlueCard,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Eyebrow('всё вместе от', color: Color(0xB3FFFFFF)),
            const SizedBox(height: 6),
            FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(rub((u['total'] ?? 0) as num), style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w800))),
            const SizedBox(height: 4),
            Text('$count ${plural(count, 'хотелка', 'хотелки', 'хотелок')} · ✓ исполнено ${u['done'] ?? 0}', style: const TextStyle(color: Color(0xB3FFFFFF))),
            const SizedBox(height: 14),
            const Divider(color: Color(0x26FFFFFF), height: 1),
            const SizedBox(height: 12),
            Row(children: [
              const Text('Город поиска', style: TextStyle(color: Color(0xB3FFFFFF))),
              const Spacer(),
              Text(Api.i.city.isEmpty ? 'Вся Россия' : Api.i.city, style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: Btn('Добавить', kind: BtnKind.primary, onTap: widget.onAdd)),
              const SizedBox(width: 10),
              Expanded(child: Btn('Хотелки', kind: BtnKind.light, onTap: widget.onOpenList)),
            ]),
          ]),
        ),
        const SizedBox(height: 22),
        row(Icons.place_rounded, 'Город', 'Авито ищет объявления рядом с вами', () => pickCity(context, () => setState(() {}))),
        const Divider(color: C.sep, height: 1),
        row(Icons.send_rounded, 'Телеграм-бот', 'Пишите название или шлите фото — @${Api.i.bot}', () => launchUrl(Uri.parse('https://t.me/${Api.i.bot}'), mode: LaunchMode.externalApplication)),
        const Divider(color: C.sep, height: 1),
        row(Icons.shield_rounded, 'Безопасность покупок', 'Только оплата в рублях, проверка сайтов', () => toast(context, 'Подозрительные сайты и цены помечаем в карточке товара')),
        const Divider(color: C.sep, height: 1),
        row(Icons.logout_rounded, 'Выйти', 'Хотелки останутся в аккаунте', () async {
          await Api.i.logout();
          widget.onLogout();
        }, color: C.red),
      ],
    );
  }
}
