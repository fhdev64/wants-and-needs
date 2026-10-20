import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ---------- tokens: near-black + electric blue ----------
class C {
  static const base = Color(0xFF05060A);
  static const panel = Color(0xCC12141B); // dark glass
  static const panel2 = Color(0xFF1A1D27);
  static const label = Color(0xFFF4F6FB);
  static const label2 = Color(0xFF9BA1B3);
  static const label3 = Color(0xFF5E6478);
  static const fill = Color(0x14FFFFFF);
  static const fill2 = Color(0x1FFFFFFF);
  static const sep = Color(0x14FFFFFF);
  static const blue = Color(0xFF2F5BFF);
  static const blueDeep = Color(0xFF1937E6);
  static const price = Color(0xFFA9CBFF); // light-blue prices
  static const gold = Color(0xFFE9C46A); // small accent labels
  static const tg = Color(0xFF2AA3EA);
  static const green = Color(0xFF4ADE80);
  static const red = Color(0xFFFF5A5F);
  static const orange = Color(0xFFFFB020);
  static const teal = Color(0xFF7CC4FF);
}

const kFont = 'Manrope';
const spring = Cubic(.2, 1.25, .3, 1);
const kRadius = 24.0;

String rub(num? n) {
  if (n == null) return '—';
  final s = n.round().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return '$b ₽';
}

String plural(int n, String one, String few, String many) =>
    n % 10 == 1 && n % 100 != 11 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

/// small uppercase label above titles ("ROLEX", "GOLD BOX")
class Eyebrow extends StatelessWidget {
  final String text;
  final Color color;
  const Eyebrow(this.text, {super.key, this.color = C.label2});
  @override
  Widget build(BuildContext context) =>
      Text(text.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1.1, color: color));
}

// ---------- background: black with deep electric-blue glow ----------
class Wallpaper extends StatefulWidget {
  final Widget child;
  const Wallpaper({super.key, required this.child});
  @override
  State<Wallpaper> createState() => _WallpaperState();
}

class _WallpaperState extends State<Wallpaper> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 24))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: C.base,
      child: Stack(fit: StackFit.expand, children: [
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, _) {
              final t = Curves.easeInOut.transform(_c.value);
              return DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(-.6 + t * .5, -1.15),
                    radius: 1.1,
                    colors: const [Color(0x8C1F44FF), Color(0x330B1E8F), Color(0x0005060A)],
                    stops: const [0, .45, 1],
                  ),
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment(.9 - t * .4, 1.2),
                      radius: 1.0,
                      colors: const [Color(0x731A3BFF), Color(0x1A0A1B7A), Color(0x0005060A)],
                      stops: const [0, .5, 1],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        widget.child,
      ]),
    );
  }
}

// ---------- dark glass panel ----------
class Glass extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsets padding;
  final double blur;
  final Color? tint;
  final Gradient? gradient;
  const Glass({super.key, required this.child, this.radius = kRadius, this.padding = const EdgeInsets.all(10), this.blur = 24, this.tint, this.gradient});

  @override
  Widget build(BuildContext context) {
    final r = BorderRadius.circular(radius);
    return ClipRRect(
      borderRadius: r,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: r,
            color: gradient == null ? (tint ?? C.panel) : null,
            gradient: gradient,
            border: Border.all(color: const Color(0x14FFFFFF)),
          ),
          foregroundDecoration: BoxDecoration(borderRadius: r, border: GradientBorder(radius: radius)),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// faint top-lit rim
class GradientBorder extends BoxBorder {
  final double radius;
  const GradientBorder({required this.radius});
  @override
  BorderSide get top => BorderSide.none;
  @override
  BorderSide get bottom => BorderSide.none;
  @override
  bool get isUniform => true;
  @override
  EdgeInsetsGeometry get dimensions => const EdgeInsets.all(1);
  @override
  ShapeBorder scale(double t) => this;
  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection, BoxShape shape = BoxShape.rectangle, BorderRadius? borderRadius}) {
    final rr = RRect.fromRectAndRadius(rect.deflate(.5), Radius.circular(radius));
    canvas.drawRRect(
      rr,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..shader = const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0x33FFFFFF), Color(0x00FFFFFF)], stops: [0, .5]).createShader(rect),
    );
  }
}

/// blue gradient card (like the balance card in the reference)
const kBlueCard = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF2448F5), Color(0xFF14246E), Color(0xFF111628)], stops: [0, .55, 1]);

// ---------- pressable ----------
class Press extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  const Press({super.key, required this.child, this.onTap, this.scale = .96});
  @override
  State<Press> createState() => _PressState();
}

class _PressState extends State<Press> {
  bool _down = false;
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: widget.onTap == null ? null : (_) => setState(() => _down = true),
      onTapCancel: () => setState(() => _down = false),
      onTapUp: (_) => setState(() => _down = false),
      onTap: widget.onTap == null
          ? null
          : () {
              HapticFeedback.selectionClick();
              widget.onTap!();
            },
      child: AnimatedScale(scale: _down ? widget.scale : 1, duration: Duration(milliseconds: _down ? 110 : 450), curve: _down ? Curves.easeOut : spring, child: widget.child),
    );
  }
}

// ---------- buttons ----------
enum BtnKind { primary, light, ghost, danger }

class Btn extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final BtnKind kind;
  final bool big, busy, arrow;
  const Btn(this.label, {super.key, this.icon, this.onTap, this.kind = BtnKind.ghost, this.big = false, this.busy = false, this.arrow = false});

  @override
  Widget build(BuildContext context) {
    final h = big ? 58.0 : 48.0;
    final fg = kind == BtnKind.light ? const Color(0xFF0B0D14) : Colors.white;
    final deco = switch (kind) {
      BtnKind.primary => BoxDecoration(
          borderRadius: BorderRadius.circular(h),
          gradient: const LinearGradient(colors: [Color(0xFF3B66FF), Color(0xFF1A3BF0)]),
          boxShadow: const [BoxShadow(color: Color(0x662F5BFF), blurRadius: 24, offset: Offset(0, 8))],
        ),
      BtnKind.light => BoxDecoration(borderRadius: BorderRadius.circular(h), color: const Color(0xFFF2F4F8)),
      BtnKind.danger => BoxDecoration(borderRadius: BorderRadius.circular(h), color: const Color(0x26FF5A5F), border: Border.all(color: const Color(0x33FF5A5F))),
      BtnKind.ghost => BoxDecoration(borderRadius: BorderRadius.circular(h), color: C.fill2, border: Border.all(color: const Color(0x14FFFFFF))),
    };
    return Press(
      onTap: busy ? null : onTap,
      child: AnimatedOpacity(
        opacity: onTap == null && !busy ? .5 : 1,
        duration: const Duration(milliseconds: 200),
        child: Container(
          height: h,
          decoration: deco,
          // label centred across the whole button; the arrow circle is pinned to the right edge
          child: Stack(alignment: Alignment.center, children: [
            Padding(
              padding: EdgeInsets.symmetric(horizontal: arrow ? h : 22),
              child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
                if (busy)
                  SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: fg))
                else if (icon != null)
                  Icon(icon, size: big ? 21 : 19, color: fg),
                if (busy || icon != null) const SizedBox(width: 9),
                Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: big ? 16.5 : 15, fontWeight: FontWeight.w700, color: fg))),
              ]),
            ),
            if (arrow)
              Positioned(
                right: 6,
                child: Container(
                  width: h - 12,
                  height: h - 12,
                  decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0x33FFFFFF)),
                  child: Icon(Icons.arrow_forward_rounded, color: fg, size: 22),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

class IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;
  final Color? color;
  final String tooltip;
  final double size;
  const IconBtn(this.icon, {super.key, this.onTap, this.color, required this.tooltip, this.size = 46});
  @override
  Widget build(BuildContext context) => Semantics(
        label: tooltip,
        button: true,
        child: Press(
          onTap: onTap,
          scale: .88,
          child: Container(
            width: size,
            height: size,
            decoration: BoxDecoration(shape: BoxShape.circle, color: C.fill, border: Border.all(color: const Color(0x1AFFFFFF))),
            child: Icon(icon, size: size * .46, color: color ?? C.label),
          ),
        ),
      );
}

// ---------- prices ----------
/// big light-blue price, as in the reference
class BigPrice extends StatelessWidget {
  final num? value;
  final String? prefix;
  final double size;
  const BigPrice(this.value, {super.key, this.prefix, this.size = 40});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(end: (value ?? 0).toDouble()),
        duration: const Duration(milliseconds: 1100),
        curve: Curves.easeOutQuart,
        builder: (_, v, _) => Text.rich(
          TextSpan(children: [
            if (prefix != null) TextSpan(text: '$prefix ', style: TextStyle(fontSize: size * .42, fontWeight: FontWeight.w600, color: C.price.withValues(alpha: .7))),
            TextSpan(text: value == null ? rub(null) : rub(v), style: TextStyle(fontSize: size, fontWeight: FontWeight.w800, color: C.price, fontFeatures: const [FontFeature.tabularFigures()])),
          ]),
          textAlign: TextAlign.center,
        ),
      );
}

class PriceCapsule extends StatelessWidget {
  final num? value;
  final bool best, big, dim;
  final String? prefix;
  const PriceCapsule(this.value, {super.key, this.best = false, this.big = false, this.prefix, this.dim = false});
  @override
  Widget build(BuildContext context) => Opacity(
        opacity: dim ? .5 : 1,
        child: Container(
          height: big ? 40 : 34,
          padding: EdgeInsets.symmetric(horizontal: big ? 15 : 12),
          decoration: BoxDecoration(
            color: best ? C.blue.withValues(alpha: .22) : C.fill,
            borderRadius: BorderRadius.circular(40),
            border: Border.all(color: best ? C.blue.withValues(alpha: .5) : const Color(0x14FFFFFF)),
          ),
          child: Center(
            widthFactor: 1,
            child: Text.rich(TextSpan(children: [
              if (prefix != null) TextSpan(text: '$prefix ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: C.label2)),
              TextSpan(text: rub(value), style: TextStyle(fontSize: big ? 17 : 15, fontWeight: FontWeight.w800, color: C.price, fontFeatures: const [FontFeature.tabularFigures()])),
            ])),
          ),
        ),
      );
}

class Tag extends StatelessWidget {
  final String text;
  final IconData? icon;
  final Color? color;
  const Tag(this.text, {super.key, this.icon, this.color});
  @override
  Widget build(BuildContext context) {
    final c = color ?? C.label2;
    return Container(
      height: 26,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(color: color == null ? C.fill : c.withValues(alpha: .14), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: c), const SizedBox(width: 5)],
        Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c))),
      ]),
    );
  }
}

/// filter chips like "All · Grail · Tourbillon"
class Chips extends StatelessWidget {
  final List<(String, String)> items;
  final String value;
  final ValueChanged<String> onChanged;
  final Map<String, int>? counts;
  const Chips({super.key, required this.items, required this.value, required this.onChanged, this.counts});
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        child: Row(children: [
          for (final (k, l) in items)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Press(
                onTap: () => onChanged(k),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  height: 38,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: k == value ? C.blue : C.fill,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: k == value ? C.blue : const Color(0x1FFFFFFF)),
                  ),
                  child: Center(
                    widthFactor: 1,
                    child: Text.rich(TextSpan(children: [
                      TextSpan(text: l, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: k == value ? Colors.white : C.label2)),
                      if (counts != null) TextSpan(text: '  ${counts![k] ?? 0}', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: k == value ? const Color(0xB3FFFFFF) : C.label3)),
                    ])),
                  ),
                ),
              ),
            ),
        ]),
      );
}

// keep the old name used by some screens
class Segmented extends Chips {
  const Segmented({super.key, required super.items, required super.value, required super.onChanged, super.counts});
}

// ---------- product image on a soft light tile ----------
class ProductImage extends StatelessWidget {
  final String? url;
  final String name;
  final double height;
  final double radius;
  const ProductImage({super.key, this.url, required this.name, this.height = 150, this.radius = 18});

  Widget _placeholder() => Container(
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFF2448F5), Color(0xFF16205A)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        alignment: Alignment.center,
        child: Text(name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase(), style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w800, color: Color(0xD9FFFFFF))),
      );

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: (url == null || url!.isEmpty)
              ? _placeholder()
              : DecoratedBox(
                  decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFFF4F6FA), Color(0xFFDDE3EE)])),
                  child: Padding(padding: const EdgeInsets.all(12), child: Image.network(url!, fit: BoxFit.contain, errorBuilder: (_, _, _) => _placeholder())),
                ),
        ),
      );
}

/// hero: product floating on a blue glow with drifting sparkles
class HeroStage extends StatefulWidget {
  final String? url;
  final String name;
  final double height;
  const HeroStage({super.key, this.url, required this.name, this.height = 300});
  @override
  State<HeroStage> createState() => _HeroStageState();
}

class _HeroStageState extends State<HeroStage> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 8))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox(
        height: widget.height,
        child: Stack(alignment: Alignment.center, children: [
          const Positioned.fill(
            child: DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(radius: .75, colors: [Color(0x992F5BFF), Color(0x261937E6), Color(0x0005060A)], stops: [0, .55, 1]))),
          ),
          Positioned.fill(child: RepaintBoundary(child: AnimatedBuilder(animation: _c, builder: (_, _) => CustomPaint(painter: _Sparkles(_c.value))))),
          SizedBox(
            width: widget.height * .82,
            child: ProductImage(url: widget.url, name: widget.name, height: widget.height * .82, radius: 28),
          ),
        ]),
      );
}

class _Sparkles extends CustomPainter {
  final double t;
  _Sparkles(this.t);
  static final _pts = List.generate(26, (i) {
    final r = math.Random(i * 7919);
    return (r.nextDouble(), r.nextDouble(), r.nextDouble() * 1.6 + .6, r.nextDouble());
  });
  @override
  void paint(Canvas canvas, Size s) {
    for (final (x, y, sz, ph) in _pts) {
      final a = (math.sin((t + ph) * math.pi * 2) + 1) / 2;
      final dy = ((y - t * .08) % 1) * s.height;
      canvas.drawCircle(Offset(x * s.width, dy), sz, Paint()..color = Colors.white.withValues(alpha: .15 + a * .55));
    }
  }

  @override
  bool shouldRepaint(_Sparkles o) => o.t != t;
}

class Shimmer extends StatefulWidget {
  final double height;
  final double radius;
  const Shimmer({super.key, this.height = 56, this.radius = 18});
  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: _c,
        builder: (_, _) => Container(
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(begin: Alignment(-2 + _c.value * 3, 0), end: Alignment(-1 + _c.value * 3, 0), colors: const [Color(0x0AFFFFFF), Color(0x1AFFFFFF), Color(0x0AFFFFFF)]),
          ),
        ),
      );
}

void toast(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(text, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, color: C.label, fontFamily: kFont)),
      behavior: SnackBarBehavior.floating,
      backgroundColor: const Color(0xF0161925),
      shape: const StadiumBorder(side: BorderSide(color: Color(0x1FFFFFFF))),
      margin: const EdgeInsets.fromLTRB(40, 0, 40, 110),
      duration: const Duration(milliseconds: 2400),
    ));
}

Route<T> glassRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 480),
      reverseTransitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (_, _, _) => page,
      transitionsBuilder: (_, a, _, child) {
        final c = CurvedAnimation(parent: a, curve: const Cubic(.2, 1, .3, 1), reverseCurve: Curves.easeIn);
        return FadeTransition(opacity: c, child: SlideTransition(position: Tween(begin: const Offset(0, .06), end: Offset.zero).animate(c), child: child));
      },
    );

/// content scrolling under the status bar is blurred and dimmed
class ScrollEdge extends StatelessWidget {
  const ScrollEdge({super.key});
  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.paddingOf(context).top + 18;
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      height: h,
      child: IgnorePointer(
        child: ShaderMask(
          shaderCallback: (r) => const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black, Colors.black, Colors.transparent], stops: [0, .6, 1]).createShader(r),
          blendMode: BlendMode.dstIn,
          child: ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12), child: Container(color: const Color(0xA605060A)))),
        ),
      ),
    );
  }
}

/// bottom sheet in the reference style (blue-tinted dark glass)
Future<T?> glassSheet<T>(BuildContext context, Widget Function(BuildContext) builder) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x99000000),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(ctx).bottom),
        child: Glass(
          radius: 30,
          padding: EdgeInsets.fromLTRB(20, 12, 20, 20 + MediaQuery.paddingOf(ctx).bottom),
          gradient: const LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xF2213A9E), Color(0xF2121726), Color(0xF20B0D14)], stops: [0, .45, 1]),
          child: builder(ctx),
        ),
      ),
    );

/// fade + slide-up with a spring, optionally delayed — used to cascade sections in
class Reveal extends StatelessWidget {
  final Widget child;
  final int delayMs;
  final double dy;
  const Reveal({super.key, required this.child, this.delayMs = 0, this.dy = 22});
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Duration(milliseconds: 650 + delayMs),
        curve: Interval(delayMs / (650 + delayMs), 1, curve: spring),
        builder: (_, v, c) => Opacity(opacity: v.clamp(0, 1), child: Transform.translate(offset: Offset(0, dy * (1 - v)), child: c)),
        child: child,
      );
}

/// a price that counts up to its value (and smoothly to new values)
class CountPrice extends StatelessWidget {
  final num? value;
  final TextStyle style;
  const CountPrice(this.value, {super.key, required this.style});
  @override
  Widget build(BuildContext context) => value == null
      ? Text(rub(null), style: style)
      : TweenAnimationBuilder<double>(
          tween: Tween(end: value!.toDouble()),
          duration: const Duration(milliseconds: 1100),
          curve: Curves.easeOutQuart,
          builder: (_, v, _) => Text(rub(v), style: style),
        );
}
