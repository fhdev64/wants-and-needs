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

Widget topBar(BuildContext context, {String? title, String? eyebrow, List<Widget> actions = const []}) => Padding(
      padding: EdgeInsets.fromLTRB(16, MediaQuery.paddingOf(context).top + 8, 16, 8),
      child: Row(children: [
        IconBtn(Icons.arrow_back_ios_new_rounded, tooltip: 'Назад', onTap: () => Navigator.of(context).maybePop()),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            if (eyebrow != null) Eyebrow(eyebrow, color: C.gold),
            if (title != null) Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 21, fontWeight: FontWeight.w800, letterSpacing: -.3)),
          ]),
        ),
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
        topBar(context, eyebrow: _candidates == null ? 'новая хотелка' : 'шаг 2 из 2', title: _candidates == null ? 'Что хотите?' : 'Выберите товар', actions: [
          if (_candidates != null || _loading) IconBtn(Icons.refresh_rounded, tooltip: 'Новый поиск', onTap: () => setState(() { _candidates = null; _image = null; _loading = false; })),
        ]),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 400),
            switchInCurve: spring,
            child: _loading ? _loadingView() : _candidates != null ? _candidatesView(bottom) : _composer(bottom),
          ),
        ),
      ]),
    );
  }

  Widget _composer(double bottom) => ListView(
        key: const ValueKey('composer'),
        padding: EdgeInsets.fromLTRB(16, 8, 16, bottom + 24),
        physics: const BouncingScrollPhysics(),
        children: [
          // primary action: big blue card with camera
          Press(
            onTap: () => _pick(ImageSource.camera),
            child: Glass(
              radius: 26,
              padding: const EdgeInsets.all(20),
              gradient: kBlueCard,
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Eyebrow('по фото', color: Color(0xB3FFFFFF)),
                    const SizedBox(height: 6),
                    const Text('Сфотографировать', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text('Наведите камеру — узнаем модель', style: TextStyle(fontSize: 13.5, color: Colors.white.withValues(alpha: .7))),
                  ]),
                ),
                Container(width: 60, height: 60, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x33FFFFFF)), child: const Icon(Icons.photo_camera_rounded, size: 30)),
              ]),
            ),
          ),
          const SizedBox(height: 10),
          Btn('Выбрать из галереи', icon: Icons.photo_library_rounded, onTap: () => _pick(ImageSource.gallery)),
          const SizedBox(height: 24),
          const Eyebrow('или по названию'),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.fromLTRB(18, 4, 6, 4),
            decoration: BoxDecoration(color: C.fill, borderRadius: BorderRadius.circular(30), border: Border.all(color: const Color(0x1AFFFFFF))),
            child: Row(children: [
              const Icon(Icons.search_rounded, color: C.label2),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _q,
                  textInputAction: TextInputAction.search,
                  onSubmitted: (_) => _identify(),
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                  decoration: const InputDecoration(border: InputBorder.none, hintText: 'AirPods 4, Dyson V15…', hintStyle: TextStyle(color: C.label3)),
                ),
              ),
              Btn('Найти', kind: BtnKind.primary, onTap: _identify),
            ]),
          ),
          const SizedBox(height: 24),
          const Eyebrow('какой товар ищем'),
          const SizedBox(height: 10),
          Chips(items: kConds.map((e) => (e.$1, e.$1 == 'any' ? 'Любой' : e.$2)).toList(), value: _cond, onChanged: (v) => setState(() => _cond = v)),
          const SizedBox(height: 18),
          Press(
            onTap: () => pickCity(context, () => setState(() {})),
            child: Glass(
              radius: 22,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(children: [
                const Icon(Icons.place_rounded, color: C.price),
                const SizedBox(width: 12),
                const Text('Город', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(Api.i.city.isEmpty ? 'Вся Россия' : Api.i.city, style: const TextStyle(color: C.label2, fontSize: 15)),
                const SizedBox(width: 6),
                const Icon(Icons.arrow_forward_rounded, color: C.label2, size: 20),
              ]),
            ),
          ),
        ],
      );

  Widget _loadingView() => Column(
        key: const ValueKey('loading'),
        children: [
          const SizedBox(height: 40),
          const CircularProgressIndicator(color: C.price),
          const SizedBox(height: 16),
          Text(_image != null ? 'Распознаю товар на фото…' : 'Подбираю варианты…', style: const TextStyle(color: C.label2, fontSize: 15)),
          const SizedBox(height: 24),
          const Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Column(children: [Shimmer(height: 84, radius: 24), SizedBox(height: 12), Shimmer(height: 84, radius: 24), SizedBox(height: 12), Shimmer(height: 84, radius: 24)])),
        ],
      );

  Widget _candidatesView(double bottom) => _candidates!.isEmpty
      ? const Center(key: ValueKey('none'), child: Text('Ничего не нашлось — уточните название', style: TextStyle(color: C.label2, fontSize: 16)))
      : ListView.separated(
          key: const ValueKey('cands'),
          padding: EdgeInsets.fromLTRB(16, 4, 16, bottom + 24),
          physics: const BouncingScrollPhysics(),
          itemCount: _candidates!.length + 1,
          separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            if (i == 0) return const Padding(padding: EdgeInsets.fromLTRB(4, 0, 4, 4), child: Text('Цены начнём искать сразу после выбора', style: TextStyle(color: C.label2)));
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
                        Eyebrow([c['brand'], c['category']].where((x) => (x ?? '').toString().isNotEmpty).join(' · ').ifEmpty('товар')),
                        const SizedBox(height: 4),
                        Text(c['name'] ?? '', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, height: 1.25)),
                        if ((c['summary'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(c['summary'], style: const TextStyle(color: C.label2, fontSize: 14))),
                      ]),
                    ),
                    const SizedBox(width: 10),
                    Container(width: 40, height: 40, decoration: const BoxDecoration(shape: BoxShape.circle, color: C.fill), child: const Icon(Icons.arrow_forward_rounded, size: 20)),
                  ]),
                ),
              ),
            );
          },
        );
}

extension on String {
  String ifEmpty(String other) => isEmpty ? other : this;
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
  late bool _done = widget.saved?['done'] == true;
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
      if (mounted) toast(context, 'Добавлено в хотелки ✦');
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

  Future<void> _toggleDone() async {
    try {
      final r = await Api.i.setDone(_it['id'], !_done);
      HapticFeedback.mediumImpact();
      setState(() => _done = r['done'] == true);
      if (mounted) toast(context, _done ? 'Исполнено! ✦' : 'Вернул в хотелки');
    } catch (e) {
      if (mounted) toast(context, e.toString());
    }
  }

  void _refresh() {
    setState(() => _refreshing = true);
    _start(Api.i.refreshItem(_it['id']));
  }

  // reference-style "Details" sheet: two-column spec grid + description
  void _details() {
    final info = _info;
    final specs = (info?['specs'] as List? ?? []).whereType<List>().where((s) => s.length >= 2).toList();
    glassSheet(
      context,
      (ctx) => ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(ctx).height * .8),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              IconBtn(Icons.arrow_back_ios_new_rounded, tooltip: 'Назад', size: 40, onTap: () => Navigator.pop(ctx)),
              const SizedBox(width: 12),
              const Expanded(child: Text('Подробнее', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800))),
              IconBtn(Icons.close_rounded, tooltip: 'Закрыть', size: 40, onTap: () => Navigator.pop(ctx)),
            ]),
            const SizedBox(height: 18),
            if (specs.isNotEmpty)
              LayoutBuilder(builder: (_, cs) {
                final w = (cs.maxWidth - 1) / 2;
                return Wrap(children: [
                  for (var i = 0; i < specs.length; i++)
                    Container(
                      width: w,
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
                      decoration: BoxDecoration(border: Border(
                        right: i.isEven ? const BorderSide(color: Color(0x1FFFFFFF)) : BorderSide.none,
                        bottom: i < specs.length - (specs.length.isEven ? 2 : 1) ? const BorderSide(color: Color(0x1FFFFFFF)) : BorderSide.none,
                      )),
                      child: Column(children: [
                        Text('${specs[i][0]}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 13, color: Color(0xB3FFFFFF))),
                        const SizedBox(height: 4),
                        Text('${specs[i][1]}', textAlign: TextAlign.center, style: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700)),
                      ]),
                    ),
                ]);
              }),
            if ((info?['description'] ?? '').toString().isNotEmpty) ...[
              const SizedBox(height: 18),
              Text(info!['description'], style: const TextStyle(fontSize: 15, height: 1.55, color: Color(0xE6FFFFFF))),
            ],
            const SizedBox(height: 14),
            for (final p in (info?['pros'] as List? ?? [])) _pc(p.toString(), true),
            for (final c in (info?['cons'] as List? ?? [])) _pc(c.toString(), false),
            if (info == null) const Text('Описание ещё загружается…', style: TextStyle(color: C.label2)),
          ]),
        ),
      ),
    );
  }

  Widget _pc(String t, bool plus) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(plus ? Icons.add_circle_rounded : Icons.remove_circle_rounded, size: 18, color: plus ? C.green : C.red),
          const SizedBox(width: 8),
          Expanded(child: Text(t, style: const TextStyle(fontSize: 14.5, height: 1.4))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final offers = _offers;
    final visible = offers.where((o) => matchCond(o, _filter)).toList();
    final counts = {for (final (k, _) in kConds) k: offers.where((o) => matchCond(o, k)).length};
    final src = _job ?? _it;
    final city = (src['city'] ?? Api.i.city).toString();
    final mainPrice = (src['minNew'] ?? src['minPrice']) as num?;
    final w = MediaQuery.sizeOf(context).width;

    return Scaffold(
      body: Stack(children: [
        CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: topBar(context, actions: [
                if (_saved && widget.saved != null) ...[
                  IconBtn(Icons.delete_outline_rounded, tooltip: 'Удалить', color: C.red, onTap: _delete),
                ],
              ]),
            ),
            SliverToBoxAdapter(child: Hero(tag: 'img-${_it['id']}', child: HeroStage(url: _image, name: _it['name'] ?? '', height: (w * .78).clamp(240, 360)))),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 6, 16, bottom + 110),
              sliver: SliverList.list(children: [
                Center(child: Eyebrow([(_it['brand'] ?? '').toString(), city.isEmpty ? 'вся россия' : city].where((x) => x.isNotEmpty).join(' · '))),
                const SizedBox(height: 6),
                Text(_it['name'] ?? '', textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, height: 1.25)),
                const SizedBox(height: 8),
                Center(child: _loading && mainPrice == null ? const Padding(padding: EdgeInsets.all(10), child: Shimmer(height: 40, radius: 12)) : BigPrice(mainPrice, prefix: 'от')),
                const SizedBox(height: 4),
                Center(
                  child: Text(
                    [
                      if (src['minNew'] != null) 'НОВЫЙ',
                      if (src['minUsed'] != null) 'Б/У ОТ ${rub(src['minUsed'] as num?)}',
                      if (src['minDiscounted'] != null) 'УЦЕНКА ОТ ${rub(src['minDiscounted'] as num?)}',
                    ].join('   |   '),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: .8, color: C.label2),
                  ),
                ),
                const SizedBox(height: 10),
                Center(
                  child: TextButton(
                    onPressed: _details,
                    child: const Row(mainAxisSize: MainAxisSize.min, children: [
                      Text('Подробнее', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: C.label)),
                      SizedBox(width: 4),
                      Icon(Icons.chevron_right_rounded, color: C.label),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),
                // prices
                Glass(
                  padding: const EdgeInsets.fromLTRB(14, 16, 14, 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Eyebrow('предложения', color: C.gold),
                      const Spacer(),
                      if (_loading) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: C.price)),
                    ]),
                    const SizedBox(height: 4),
                    const Text('Цены от низкой к высокой', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    Chips(items: kConds, value: _filter, counts: counts, onChanged: (v) => setState(() => _filter = v)),
                    const SizedBox(height: 12),
                    if (_status.isNotEmpty) Wrap(spacing: 6, runSpacing: 6, children: [for (final g in (_job?['groups'] as List? ?? _defaultGroups)) _sourceChip(g as Json, offers)]),
                    const SizedBox(height: 6),
                    for (var i = 0; i < visible.length; i++) _OfferRow(o: visible[i], best: i == 0 && !(visible[i]['flags'] as List? ?? []).contains('cheap'), city: city),
                    if (_loading) ...const [SizedBox(height: 8), Shimmer(), SizedBox(height: 8), Shimmer()],
                    if (!_loading && visible.isEmpty)
                      Padding(padding: const EdgeInsets.all(14), child: Text(offers.isEmpty ? 'Предложений не нашлось — попробуйте площадки ниже.' : 'Нет предложений в этой категории.', style: const TextStyle(color: C.label2))),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(4, 12, 4, 8),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Icon(Icons.verified_user_outlined, size: 16, color: C.price),
                        SizedBox(width: 8),
                        Expanded(child: Text('Только оплата в рублях. Незнакомые сайты и подозрительно низкие цены отмечены. На Авито пользуйтесь «Авито Доставкой».', style: TextStyle(fontSize: 12.5, height: 1.45, color: C.label2))),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 14),
                // manual search links
                Glass(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Eyebrow('искать самостоятельно', color: C.gold),
                    const SizedBox(height: 12),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final (n, u) in _links(_it['name'] ?? ''))
                        Press(
                          onTap: () => launchUrl(Uri.parse(u), mode: LaunchMode.externalApplication),
                          child: Container(
                            height: 40,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(color: C.fill, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0x1AFFFFFF))),
                            child: Center(widthFactor: 1, child: Text(n, style: const TextStyle(fontWeight: FontWeight.w700))),
                          ),
                        ),
                    ]),
                  ]),
                ),
              ]),
            ),
          ],
        ),
        const ScrollEdge(),
        // dim the content behind the bottom actions
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: bottom + 110,
          child: const IgnorePointer(
            child: DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x0005060A), Color(0xE605060A), Color(0xFF05060A)], stops: [0, .55, 1]))),
          ),
        ),
        Positioned(
          left: 16,
          right: 16,
          bottom: bottom + 14,
          child: widget.candidate != null
              ? Btn(_saved ? 'В хотелках' : 'Добавить в хотелки', icon: _saved ? Icons.check_rounded : null, kind: _saved ? BtnKind.light : BtnKind.primary, big: true, arrow: !_saved, busy: _saving, onTap: _saved ? null : _add)
              : Row(children: [
                  Expanded(child: Btn(_done ? 'Вернуть' : 'Сбылось', icon: _done ? Icons.undo_rounded : Icons.check_circle_rounded, kind: BtnKind.light, big: true, onTap: _toggleDone)),
                  const SizedBox(width: 10),
                  Expanded(child: Btn(_refreshing ? 'Обновляю…' : 'Обновить', icon: Icons.refresh_rounded, kind: BtnKind.primary, big: true, busy: _refreshing, onTap: _refreshing ? null : _refresh)),
                ]),
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
        child: Row(mainAxisSize: MainAxisSize.min, children: [const SizedBox(width: 11, height: 11, child: CircularProgressIndicator(strokeWidth: 1.6, color: C.label2)), const SizedBox(width: 6), Text(g['label'], style: const TextStyle(fontSize: 12, color: C.label2, fontWeight: FontWeight.w600))]),
      );
    }
    if (st == 'blocked') return Tag('${g['label']}: недоступно', icon: Icons.block_rounded, color: C.orange);
    if (st == 'error') return Tag(g['label'], icon: Icons.error_outline_rounded, color: C.red);
    return Tag('${g['label']} · $n', icon: n > 0 ? Icons.check_rounded : Icons.remove_rounded, color: n > 0 ? C.price : null);
  }

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
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 14),
        decoration: const BoxDecoration(border: Border(top: BorderSide(color: C.sep))),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Eyebrow(kCondName[o['condition']] ?? 'Новый', color: o['condition'] == 'new' ? C.label2 : C.gold),
                const SizedBox(height: 2),
                Text(o['store'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800)),
              ]),
            ),
            const SizedBox(width: 10),
            PriceCapsule(o['price'] as num?, best: best, dim: flags.contains('cheap')),
            if (url.isNotEmpty) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.arrow_forward_rounded, color: C.label3, size: 20)),
          ]),
          if (note.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4, right: 30), child: Text(note, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, color: C.label2, height: 1.35))),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            if ((o['host'] ?? '').toString().isNotEmpty && !flags.contains('unknown')) Tag(o['host'], icon: Icons.verified_user_rounded, color: C.green),
            if (flags.contains('unknown')) const Tag('Незнакомый сайт', icon: Icons.warning_amber_rounded, color: C.orange),
            if (flags.contains('cheap')) const Tag('Подозрительно дёшево', icon: Icons.warning_amber_rounded, color: C.red),
            if (place.isNotEmpty) Tag(place, icon: Icons.place_rounded, color: near ? C.price : null),
          ]),
        ]),
      ),
    );
  }
}
