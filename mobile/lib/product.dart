import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import 'api.dart';
import 'main.dart' show pickCity;
import 'ui.dart';

const kConds = [('any', 'Все'), ('new', 'Новые'), ('used', 'Б/у'), ('discounted', 'Уценка')];
const kCondName = {'new': 'Новый', 'used': 'Б/у', 'discounted': 'Уценка', 'refurbished': 'Восстановл.'};
bool matchCond(Json o, String f) => f == 'any' || o['condition'] == f || (f == 'discounted' && o['condition'] == 'refurbished');

Widget topBar(BuildContext context, {String? title, List<Widget> actions = const []}) => Padding(
      padding: EdgeInsets.fromLTRB(16, MediaQuery.paddingOf(context).top + 8, 16, 8),
      child: Row(children: [
        IconBtn(Icons.arrow_back_ios_new_rounded, tooltip: 'Назад', onTap: () => Navigator.of(context).maybePop()),
        const SizedBox(width: 12),
        Expanded(child: Text(title ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700))),
        ...actions,
      ]),
    );

// ======================= Add: photo / name → candidates =======================
class AddScreen extends StatefulWidget {
  const AddScreen({super.key});
  @override
  State<AddScreen> createState() => _AddScreenState();
}

class _AddScreenState extends State<AddScreen> {
  final _q = TextEditingController();
  String _cond = 'any';
  String? _image; // data URL
  bool _loading = false;
  List<Json>? _candidates;

  Future<void> _pick(ImageSource src) async {
    final f = await ImagePicker().pickImage(source: src, maxWidth: 1024, maxHeight: 1024, imageQuality: 85);
    if (f == null) return;
    _image = 'data:image/jpeg;base64,${base64Encode(await f.readAsBytes())}';
    _identify();
  }

  Future<void> _identify() async {
    if (_image == null && _q.text.trim().isEmpty) return toast(context, 'Сфотографируйте товар или введите название');
    FocusScope.of(context).unfocus();
    setState(() { _loading = true; _candidates = null; });
    try {
      final c = await Api.i.identify(query: _q.text.trim(), image: _image);
      if (mounted) setState(() => _candidates = c);
    } catch (e) {
      if (mounted) toast(context, e.toString());
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Column(children: [
        topBar(context, title: _candidates == null ? 'Новая хотелка' : 'Выберите товар', actions: [
          if (_candidates != null || _loading) IconBtn(Icons.refresh_rounded, tooltip: 'Новый поиск', onTap: () => setState(() { _candidates = null; _image = null; _loading = false; })),
        ]),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            switchInCurve: spring,
            child: _loading
                ? _loadingView()
                : _candidates != null
                    ? _candidatesView(bottom)
                    : _composer(bottom),
          ),
        ),
      ]),
    );
  }

  Widget _composer(double bottom) => ListView(
        key: const ValueKey('composer'),
        padding: EdgeInsets.fromLTRB(16, 8, 16, bottom + 24),
        children: [
          Row(children: [
            Expanded(child: _bigAction(Icons.photo_camera_rounded, 'Сфотографировать', () => _pick(ImageSource.camera), primary: true)),
            const SizedBox(width: 12),
            Expanded(child: _bigAction(Icons.photo_library_rounded, 'Из галереи', () => _pick(ImageSource.gallery))),
          ]),
          const SizedBox(height: 18),
          const Row(children: [
            Expanded(child: Divider(color: C.sep)),
            Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('или по названию', style: TextStyle(color: C.label3, fontSize: 13))),
            Expanded(child: Divider(color: C.sep)),
          ]),
          const SizedBox(height: 18),
          Glass(
            radius: 30,
            padding: const EdgeInsets.fromLTRB(18, 4, 6, 4),
            child: Row(children: [
              const Icon(Icons.search_rounded, color: C.label2),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _q,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _identify(),
                  style: const TextStyle(fontSize: 17),
                  decoration: const InputDecoration(border: InputBorder.none, hintText: 'AirPods 4, Dyson V15…', hintStyle: TextStyle(color: C.label3)),
                ),
              ),
              Btn('Найти', prominent: true, onTap: _identify),
            ]),
          ),
          const SizedBox(height: 22),
          const Padding(padding: EdgeInsets.only(left: 6, bottom: 8), child: Text('Какой товар ищем', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: C.label2))),
          Segmented(items: kConds.map((e) => (e.$1, e.$1 == 'any' ? 'Любой' : e.$2)).toList(), value: _cond, onChanged: (v) => setState(() => _cond = v)),
          const SizedBox(height: 14),
          Press(
            onTap: () => pickCity(context, () => setState(() {})),
            child: Glass(
              radius: 24,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(children: [
                const Icon(Icons.place_rounded, color: C.teal),
                const SizedBox(width: 12),
                const Text('Город', style: TextStyle(fontSize: 16)),
                const Spacer(),
                Text(Api.i.city.isEmpty ? 'Вся Россия' : Api.i.city, style: const TextStyle(color: C.label2, fontSize: 15)),
                const Icon(Icons.chevron_right_rounded, color: C.label3),
              ]),
            ),
          ),
        ],
      );

  Widget _bigAction(IconData icon, String label, VoidCallback onTap, {bool primary = false}) => Press(
        onTap: onTap,
        child: Glass(
          tint: primary ? C.blue.withValues(alpha: .35) : null,
          padding: const EdgeInsets.symmetric(vertical: 26),
          child: Column(children: [
            Icon(icon, size: 40, color: Colors.white),
            const SizedBox(height: 10),
            Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
          ]),
        ),
      );

  Widget _loadingView() => Column(
        key: const ValueKey('loading'),
        children: [
          const SizedBox(height: 40),
          const CircularProgressIndicator(color: C.label),
          const SizedBox(height: 16),
          Text(_image != null ? 'Распознаю товар на фото…' : 'Подбираю варианты…', style: const TextStyle(color: C.label2, fontSize: 15)),
          const SizedBox(height: 24),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Column(children: [Shimmer(height: 84, radius: 26), SizedBox(height: 12), Shimmer(height: 84, radius: 26), SizedBox(height: 12), Shimmer(height: 84, radius: 26)])),
        ],
      );

  Widget _candidatesView(double bottom) => _candidates!.isEmpty
      ? const Center(key: ValueKey('none'), child: Text('Ничего не нашлось — уточните название', style: TextStyle(color: C.label2, fontSize: 16)))
      : ListView.separated(
          key: const ValueKey('cands'),
          padding: EdgeInsets.fromLTRB(16, 4, 16, bottom + 24),
          itemCount: _candidates!.length + 1,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (_, i) {
            if (i == 0) return const Padding(padding: EdgeInsets.fromLTRB(6, 0, 6, 2), child: Text('Цены начнём искать сразу после выбора', style: TextStyle(color: C.label2)));
            final c = _candidates![i - 1];
            return TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: Duration(milliseconds: 450 + i * 60),
              curve: spring,
              builder: (_, v, child) => Opacity(opacity: v.clamp(0, 1), child: Transform.translate(offset: Offset(0, 20 * (1 - v)), child: child)),
              child: Press(
                onTap: () => Navigator.of(context).pushReplacement(glassRoute(ProductScreen(candidate: c, userImage: _image, cond: _cond))),
                child: Glass(
                  padding: const EdgeInsets.all(16),
                  child: Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(c['name'] ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, height: 1.25)),
                        if ((c['summary'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(c['summary'], style: const TextStyle(color: C.label2, fontSize: 14))),
                        if ((c['category'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Tag(c['category'])),
                      ]),
                    ),
                    const Icon(Icons.chevron_right_rounded, color: C.label3, size: 28),
                  ]),
                ),
              ),
            );
          },
        );
}

// ======================= Product: live prices =======================
class ProductScreen extends StatefulWidget {
  final Json? saved; // an item from the wishlist
  final Json? candidate; // a freshly picked product
  final String? userImage;
  final String cond;
  const ProductScreen({super.key, this.saved, this.candidate, this.userImage, this.cond = 'any'});
  @override
  State<ProductScreen> createState() => _ProductScreenState();
}

class _ProductScreenState extends State<ProductScreen> {
  late Json _it = {...?widget.saved, ...?widget.candidate};
  Json? _job;
  late String _filter = widget.cond;
  bool _saved = false, _saving = false, _refreshing = false;
  StreamSubscription? _sub;

  bool get _loading => _job != null && _job!['done'] != true;
  List<Json> get _offers => ((_job?['offers'] ?? _it['offers'] ?? []) as List).cast<Json>();
  Json? get _info => _job?['info'] as Json? ?? (_it['description'] != null ? _it : null);
  Map<String, dynamic> get _status => (_job?['status'] ?? _it['status'] ?? {}) as Map<String, dynamic>;
  String? get _image => (_it['image'] as String?)?.isNotEmpty == true ? _it['image'] : ((_job?['image'] as String?)?.isNotEmpty == true ? _job!['image'] : null);

  @override
  void initState() {
    super.initState();
    _saved = widget.saved != null;
    if (widget.candidate != null) _start(Api.i.search(widget.candidate!['name']));
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _start(Future<Json> f) async {
    try {
      final j = await f;
      _sub?.cancel();
      _sub = Api.i.watch(j).listen((j) {
        if (mounted) setState(() => _job = j);
      }, onError: (e) {
        if (mounted) toast(context, e.toString());
      }, onDone: () {
        if (_refreshing && mounted) {
          setState(() => _refreshing = false);
          toast(context, 'Цены обновлены');
        }
      });
    } catch (e) {
      if (mounted) toast(context, e.toString());
    }
  }

  Future<void> _add() async {
    if (_job == null) return toast(context, 'Подождите, поиск ещё запускается');
    setState(() => _saving = true);
    try {
      final saved = await Api.i.saveItem(_job!['id'], {'brand': _it['brand'] ?? '', 'category': _it['category'] ?? '', 'image': _image ?? ''});
      HapticFeedback.mediumImpact();
      setState(() { _saved = true; _it = {..._it, 'id': saved['id']}; });
      if (mounted) toast(context, 'Добавлено в хотелки ❤️');
    } catch (e) {
      if (mounted) toast(context, e.toString());
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _delete() async {
    try {
      await Api.i.deleteItem(_it['id']);
      if (mounted) {
        toast(context, 'Удалено');
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) toast(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final offers = _offers;
    final visible = offers.where((o) => matchCond(o, _filter)).toList();
    final counts = {for (final (k, _) in kConds) k: offers.where((o) => matchCond(o, k)).length};
    final src = _job ?? _it;
    final showAdd = widget.candidate != null;

    return Scaffold(
      body: Stack(children: [
        CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: topBar(context, actions: [
                if (_saved && widget.saved != null) ...[
                  IconBtn(Icons.refresh_rounded, tooltip: 'Обновить цены', onTap: _refreshing ? null : () {
                    setState(() => _refreshing = true);
                    _start(Api.i.refreshItem(_it['id']));
                  }),
                  const SizedBox(width: 8),
                  IconBtn(Icons.delete_outline_rounded, tooltip: 'Удалить', color: C.red, onTap: _delete),
                ],
              ]),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 4, 16, bottom + (showAdd ? 110 : 30)),
              sliver: SliverList.list(children: [
                // hero card
                Glass(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Hero(tag: 'img-${_it['id']}', child: ProductImage(url: _image ?? (widget.userImage != null ? null : null), name: _it['name'] ?? '', height: 220)),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(6, 14, 6, 6),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(_it['name'] ?? '', style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800, height: 1.2, letterSpacing: -.4)),
                        const SizedBox(height: 6),
                        Row(children: [
                          const Icon(Icons.place_rounded, size: 15, color: C.label2),
                          const SizedBox(width: 4),
                          Text((src['city'] ?? Api.i.city).toString().isEmpty ? 'Вся Россия' : (src['city'] ?? Api.i.city), style: const TextStyle(color: C.label2)),
                          if ((_it['brand'] ?? '').toString().isNotEmpty) Text('  ·  ${_it['brand']}', style: const TextStyle(color: C.label2)),
                        ]),
                        const SizedBox(height: 14),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          if (src['minNew'] != null) PriceCapsule(src['minNew'], prefix: 'новый от', best: true, big: true),
                          if (src['minUsed'] != null) PriceCapsule(src['minUsed'], prefix: 'б/у от', big: true),
                          if (src['minDiscounted'] != null) PriceCapsule(src['minDiscounted'], prefix: 'уценка от', big: true),
                          if (src['minNew'] == null && src['minUsed'] == null && src['minDiscounted'] == null) PriceCapsule(src['minPrice'], prefix: 'от', big: true),
                        ]),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 16),
                // prices
                Glass(
                  padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Padding(padding: EdgeInsets.only(left: 4, bottom: 12), child: Text('Цены', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
                    Segmented(items: kConds, value: _filter, counts: counts, onChanged: (v) => setState(() => _filter = v)),
                    const SizedBox(height: 12),
                    if (_status.isNotEmpty) Wrap(spacing: 6, runSpacing: 6, children: [for (final g in (_job?['groups'] as List? ?? _defaultGroups)) _sourceChip(g as Json, offers)]),
                    const SizedBox(height: 6),
                    ...[
                      for (var i = 0; i < visible.length; i++) _OfferRow(o: visible[i], best: i == 0 && !(visible[i]['flags'] as List? ?? []).contains('cheap'), city: (src['city'] ?? '') as String),
                    ],
                    if (_loading) ...const [SizedBox(height: 8), Shimmer(), SizedBox(height: 8), Shimmer()],
                    if (!_loading && visible.isEmpty)
                      Padding(padding: const EdgeInsets.all(14), child: Text(offers.isEmpty ? 'Предложений не нашлось — попробуйте площадки ниже.' : 'Нет предложений в этой категории.', style: const TextStyle(color: C.label2))),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(6, 12, 6, 6),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(Icons.verified_user_outlined, size: 16, color: C.teal),
                        SizedBox(width: 8),
                        Expanded(child: Text('Только оплата в рублях. Незнакомые сайты и подозрительно низкие цены отмечены. На Авито пользуйтесь «Авито Доставкой» и не переводите предоплату на карту.', style: TextStyle(fontSize: 12.5, height: 1.45, color: C.label2))),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 16),
                // manual search links
                Glass(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Padding(padding: EdgeInsets.only(left: 2, bottom: 12), child: Text('Искать самостоятельно', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700))),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final (n, u) in _links(_it['name'] ?? ''))
                        Press(
                          onTap: () => launchUrl(Uri.parse(u), mode: LaunchMode.externalApplication),
                          child: Container(height: 40, padding: const EdgeInsets.symmetric(horizontal: 16), alignment: Alignment.center, decoration: BoxDecoration(color: C.fill2, borderRadius: BorderRadius.circular(20)), child: Text(n, style: const TextStyle(fontWeight: FontWeight.w600))),
                        ),
                    ]),
                  ]),
                ),
                const SizedBox(height: 16),
                _infoCard(),
              ]),
            ),
          ],
        ),
        const ScrollEdge(),
        if (showAdd)
          Positioned(
            left: 16,
            right: 16,
            bottom: bottom + 14,
            child: Btn(_saved ? 'В хотелках' : 'Добавить в хотелки', icon: _saved ? Icons.check_rounded : Icons.favorite_rounded, prominent: !_saved, big: true, busy: _saving, onTap: _saved ? null : _add),
          ),
      ]),
    );
  }

  static const _defaultGroups = [
    {'key': 'avito', 'label': 'Авито'}, {'key': 'wb', 'label': 'Wildberries'}, {'key': 'ozon', 'label': 'Ozon'}, {'key': 'ym', 'label': 'Яндекс Маркет'},
    {'key': 'retail', 'label': 'Магазины'}, {'key': 'used', 'label': 'Б/у и уценка'}, {'key': 'market', 'label': 'Мегамаркет и др.'},
  ];

  Widget _sourceChip(Json g, List<Json> offers) {
    final st = _status[g['key']];
    final n = offers.where((o) => o['group'] == g['key']).length;
    if (st == null) return const SizedBox.shrink();
    if (st == 'loading') {
      return Container(
        height: 26,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(color: C.fill, borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [const SizedBox(width: 11, height: 11, child: CircularProgressIndicator(strokeWidth: 1.6, color: C.label2)), const SizedBox(width: 6), Text(g['label'], style: const TextStyle(fontSize: 12.5, color: C.label2))]),
      );
    }
    if (st == 'blocked') return Tag('${g['label']}: недоступно', icon: Icons.block_rounded, color: C.orange);
    if (st == 'error') return Tag(g['label'], icon: Icons.error_outline_rounded, color: C.red);
    return Tag('${g['label']} · $n', icon: n > 0 ? Icons.check_rounded : Icons.remove_rounded, color: n > 0 ? C.green : null);
  }

  Widget _infoCard() {
    final info = _info;
    if (info == null) {
      if (!_loading) return const SizedBox.shrink();
      return const Glass(padding: EdgeInsets.all(16), child: Column(children: [Shimmer(height: 16, radius: 8), SizedBox(height: 10), Shimmer(height: 16, radius: 8), SizedBox(height: 10), Shimmer(height: 16, radius: 8)]));
    }
    final specs = (info['specs'] as List? ?? []);
    return Glass(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('О товаре', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        if ((info['description'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: Text(info['description'], style: const TextStyle(fontSize: 15, height: 1.55, color: Color(0xE6F0F4FF)))),
        if (specs.isNotEmpty) ...[
          const SizedBox(height: 14),
          for (final s in specs)
            if (s is List && s.length >= 2)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(flex: 4, child: Text('${s[0]}', style: const TextStyle(color: C.label2))),
                  Expanded(flex: 6, child: Text('${s[1]}')),
                ]),
              ),
        ],
        const SizedBox(height: 12),
        for (final p in (info['pros'] as List? ?? [])) _pc(p.toString(), true),
        for (final c in (info['cons'] as List? ?? [])) _pc(c.toString(), false),
      ]),
    );
  }

  Widget _pc(String t, bool plus) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(plus ? Icons.check_rounded : Icons.remove_rounded, size: 18, color: plus ? C.green : C.red),
          const SizedBox(width: 8),
          Expanded(child: Text(t, style: const TextStyle(fontSize: 14.5, height: 1.4))),
        ]),
      );

  List<(String, String)> _links(String name) {
    final q = Uri.encodeComponent(name);
    return [
      ('Авито', 'https://www.avito.ru/rossiya?q=$q'), ('Ozon', 'https://www.ozon.ru/search/?text=$q'), ('Wildberries', 'https://www.wildberries.ru/catalog/0/search.aspx?search=$q'),
      ('Яндекс Маркет', 'https://market.yandex.ru/search?text=$q'), ('Мегамаркет', 'https://megamarket.ru/catalog/?q=$q'), ('DNS', 'https://www.dns-shop.ru/search/?q=$q'),
      ('М.Видео', 'https://www.mvideo.ru/product-list-page?q=$q'), ('AliExpress', 'https://aliexpress.ru/wholesale?SearchText=$q'),
    ];
  }
}

class _OfferRow extends StatelessWidget {
  final Json o;
  final bool best;
  final String city;
  const _OfferRow({required this.o, required this.best, required this.city});

  @override
  Widget build(BuildContext context) {
    final flags = (o['flags'] as List? ?? []);
    final url = (o['url'] ?? '') as String;
    final place = (o['place'] ?? '') as String;
    final near = city.isNotEmpty && place.toLowerCase().contains(city.toLowerCase());
    final note = (o['note'] ?? '').toString();
    return Press(
      scale: .98,
      onTap: url.isEmpty ? null : () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 14),
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.sep))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // line 1: store + price, so the price never fights the tags for width
          Row(children: [
            Expanded(child: Text(o['store'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700))),
            const SizedBox(width: 10),
            PriceCapsule(o['price'] as num?, best: best, dim: flags.contains('cheap')),
            if (url.isNotEmpty) const Icon(Icons.chevron_right_rounded, color: C.label3),
          ]),
          if (note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4, right: 30), child: Text(note, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, color: C.label2, height: 1.35))),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            Tag(kCondName[o['condition']] ?? 'Новый'),
            if ((o['host'] ?? '').toString().isNotEmpty && !flags.contains('unknown')) Tag(o['host'], icon: Icons.verified_user_rounded, color: C.green),
            if (flags.contains('unknown')) const Tag('Незнакомый сайт', icon: Icons.warning_amber_rounded, color: C.orange),
            if (flags.contains('cheap')) const Tag('Подозрительно дёшево', icon: Icons.warning_amber_rounded, color: C.red),
            if (place.isNotEmpty) Tag(place, icon: Icons.place_rounded, color: near ? C.teal : null),
          ]),
        ]),
      ),
    );
  }
}
