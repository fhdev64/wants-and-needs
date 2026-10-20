import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ---------- tokens (same palette as the desktop app) ----------
class C {
  static const base = Color(0xFF0B1016);
  static const label = Color(0xF5FFFFFF);
  static const label2 = Color(0xA8EBF0FF);
  static const label3 = Color(0x66EBF0FF);
  static const fill = Color(0x14FFFFFF);
  static const fill2 = Color(0x21FFFFFF);
  static const sep = Color(0x1AFFFFFF);
  static const blue = Color(0xFF0A84FF);
  static const tg = Color(0xFF2AA3EA);
  static const green = Color(0xFF32D74B);
  static const red = Color(0xFFFF453A);
  static const orange = Color(0xFFFF9F0A);
  static const teal = Color(0xFF64D2FF);
}

const spring = Cubic(.2, 1.3, .3, 1); // gentle overshoot, like Apple's spring
const kRadius = 26.0; // panels; inner elements: 26 − padding 10 = 16

String rub(num? n) {
  if (n == null) return '—';
  final s = n.round().toString();
  final b = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) b.write(' ');
    b.write(s[i]);
  }
  return '$b ₽';
}

String plural(int n, String one, String few, String many) =>
    n % 10 == 1 && n % 100 != 11 ? one : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

// ---------- wallpaper: soft drifting color fields ----------
class Wallpaper extends StatefulWidget {
  final Widget child;
  const Wallpaper({super.key, required this.child});
  @override
  State<Wallpaper> createState() => _WallpaperState();
}

class _WallpaperState extends State<Wallpaper> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(seconds: 30))..repeat(reverse: true);
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Widget blob(double t, Color color, Alignment a, double size, double phase) {
    final dx = math.sin((t + phase) * math.pi * 2) * .25, dy = math.cos((t + phase) * math.pi * 2) * .2;
    return Align(
      alignment: Alignment(a.x + dx, a.y + dy),
      child: Container(width: size, height: size * .7, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(size))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    return ColoredBox(
      color: C.base,
      child: Stack(fit: StackFit.expand, children: [
        RepaintBoundary(
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, __) => ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 60, sigmaY: 60),
              child: Stack(children: [
                blob(_c.value, const Color(0xD90F5C6E), const Alignment(-1.1, -.9), w * 1.3, 0),
                blob(_c.value, const Color(0x993A3FD6), const Alignment(1.1, -.1), w * 1.1, .3),
                blob(_c.value, const Color(0x801C8B92), const Alignment(-.3, 1.1), w * 1.2, .6),
                blob(_c.value, const Color(0x597A4BD6), const Alignment(.9, .9), w * .8, .8),
              ]),
            ),
          ),
        ),
        const DecoratedBox(
          decoration: BoxDecoration(gradient: RadialGradient(radius: 1.2, colors: [Colors.transparent, Color(0x8C05080C)], stops: [.45, 1])),
        ),
        widget.child,
      ]),
    );
  }
}

// ---------- frosted glass panel ----------
class Glass extends StatelessWidget {
  final Widget child;
  final double radius;
  final EdgeInsets padding;
  final double blur;
  final Color? tint;
  const Glass({super.key, required this.child, this.radius = kRadius, this.padding = const EdgeInsets.all(10), this.blur = 30, this.tint});

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
            color: tint,
            gradient: tint == null
                ? const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0x1CFFFFFF), Color(0x0BFFFFFF), Color(0x12FFFFFF)], stops: [0, .6, 1])
                : null,
          ),
          // thin luminous rim, brighter on the lit (top-left) edge
          foregroundDecoration: BoxDecoration(
            borderRadius: r,
            border: GradientBorder(radius: radius),
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

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
    final p = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Color(0x6BFFFFFF), Color(0x14FFFFFF), Color(0x00FFFFFF), Color(0x0FFFFFFF), Color(0x42FFFFFF)],
        stops: [0, .28, .5, .72, 1],
      ).createShader(rect);
    canvas.drawRRect(rr, p);
  }
}

// ---------- pressable: springy scale + haptic ----------
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
      child: AnimatedScale(scale: _down ? widget.scale : 1, duration: Duration(milliseconds: _down ? 120 : 450), curve: _down ? Curves.easeOut : spring, child: widget.child),
    );
  }
}

// ---------- buttons ----------
class Btn extends StatelessWidget {
  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final bool prominent, big, busy;
  final Color? color;
  const Btn(this.label, {super.key, this.icon, this.onTap, this.prominent = false, this.big = false, this.busy = false, this.color});

  @override
  Widget build(BuildContext context) {
    final h = big ? 56.0 : 46.0;
    final bg = color ?? (prominent ? C.blue.withValues(alpha: .9) : C.fill2);
    return Press(
      onTap: busy ? null : onTap,
      child: AnimatedOpacity(
        opacity: onTap == null && !busy ? .5 : 1,
        duration: const Duration(milliseconds: 200),
        child: Container(
          height: h,
          padding: const EdgeInsets.symmetric(horizontal: 22),
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(h),
            border: const Border(top: BorderSide(color: Color(0x40FFFFFF), width: .8)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
            if (busy)
              const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: Colors.white))
            else if (icon != null)
              Icon(icon, size: big ? 22 : 19, color: Colors.white),
            if (busy || icon != null) const SizedBox(width: 10),
            Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: big ? 17 : 15, fontWeight: FontWeight.w600, color: Colors.white))),
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
  const IconBtn(this.icon, {super.key, this.onTap, this.color, required this.tooltip});
  @override
  Widget build(BuildContext context) => Semantics(
        label: tooltip,
        button: true,
        child: Press(
          onTap: onTap,
          scale: .88,
          child: Glass(radius: 24, padding: EdgeInsets.zero, blur: 20, child: SizedBox(width: 48, height: 48, child: Icon(icon, size: 22, color: color ?? C.label))),
        ),
      );
}

// ---------- capsules ----------
class PriceCapsule extends StatelessWidget {
  final num? value;
  final bool best, big;
  final String? prefix;
  final bool dim;
  const PriceCapsule(this.value, {super.key, this.best = false, this.big = false, this.prefix, this.dim = false});
  @override
  Widget build(BuildContext context) => Opacity(
        opacity: dim ? .55 : 1,
        child: Container(
          height: big ? 40 : 34,
          padding: EdgeInsets.symmetric(horizontal: big ? 16 : 13),
          decoration: BoxDecoration(
            color: best ? C.green.withValues(alpha: .2) : const Color(0x1FFFFFFF),
            borderRadius: BorderRadius.circular(40),
            border: const Border(top: BorderSide(color: Color(0x26FFFFFF), width: .8)),
          ),
          // widthFactor 1: hug the content instead of stretching inside Wrap/Column
          child: Center(widthFactor: 1, child: Text.rich(TextSpan(children: [
            if (prefix != null) TextSpan(text: '$prefix ', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: C.label2)),
            TextSpan(text: rub(value), style: TextStyle(fontSize: big ? 18 : 15.5, fontWeight: FontWeight.w700, color: best ? const Color(0xFF86F59A) : C.label, fontFeatures: const [FontFeature.tabularFigures()])),
          ]))),
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
      decoration: BoxDecoration(color: color == null ? C.fill : c.withValues(alpha: .15), borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: c), const SizedBox(width: 5)],
        Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500, color: c))),
      ]),
    );
  }
}

// ---------- segmented control with sliding thumb ----------
class Segmented extends StatelessWidget {
  final List<(String, String)> items; // (key, label)
  final String value;
  final ValueChanged<String> onChanged;
  final Map<String, int>? counts;
  const Segmented({super.key, required this.items, required this.value, required this.onChanged, this.counts});

  @override
  Widget build(BuildContext context) {
    final idx = items.indexWhere((e) => e.$1 == value).clamp(0, items.length - 1);
    return Container(
      height: 44,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: const Color(0x38000000), borderRadius: BorderRadius.circular(22)),
      child: LayoutBuilder(builder: (_, cs) {
        final w = cs.maxWidth / items.length;
        return Stack(children: [
          AnimatedPositioned(
            duration: const Duration(milliseconds: 500),
            curve: spring,
            left: w * idx,
            top: 0,
            bottom: 0,
            width: w,
            child: Container(decoration: BoxDecoration(color: const Color(0x29FFFFFF), borderRadius: BorderRadius.circular(18), border: const Border(top: BorderSide(color: Color(0x40FFFFFF), width: .8)))),
          ),
          Row(children: [
            for (final (k, l) in items)
              Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onChanged(k);
                  },
                  child: Center(
                    child: Text.rich(
                      TextSpan(children: [
                        TextSpan(text: l, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: k == value ? C.label : C.label2)),
                        if (counts != null) TextSpan(text: ' ${counts![k] ?? 0}', style: const TextStyle(fontSize: 12, color: C.label3)),
                      ]),
                      maxLines: 1,
                    ),
                  ),
                ),
              ),
          ]),
        ]);
      }),
    );
  }
}

// ---------- product image (with graceful fallback) ----------
class ProductImage extends StatelessWidget {
  final String? url;
  final String name;
  final double height;
  final double radius;
  const ProductImage({super.key, this.url, required this.name, this.height = 150, this.radius = 16});

  Widget _placeholder() => Container(
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0x4D64D2FF), Color(0x4D5E5CE6), Color(0x40BF5AF2)], begin: Alignment.topLeft, end: Alignment.bottomRight)),
        alignment: Alignment.center,
        child: Text(name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase(), style: const TextStyle(fontSize: 44, fontWeight: FontWeight.w700, color: Color(0xD9FFFFFF))),
      );

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: SizedBox(
          height: height,
          width: double.infinity,
          child: (url == null || url!.isEmpty)
              ? _placeholder()
              : ColoredBox(
                  color: const Color(0xFFF4F5F7),
                  child: Padding(
                    padding: const EdgeInsets.all(10),
                    child: Image.network(url!, fit: BoxFit.contain, errorBuilder: (_, __, ___) => _placeholder()),
                  ),
                ),
        ),
      );
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
        builder: (_, __) => Container(
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.radius),
            gradient: LinearGradient(
              begin: Alignment(-1 + _c.value * 3 - 1, 0),
              end: Alignment(_c.value * 3 - 1, 0),
              colors: const [Color(0x0DFFFFFF), Color(0x1FFFFFFF), Color(0x0DFFFFFF)],
            ),
          ),
        ),
      );
}

void toast(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(text, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w600, color: C.label)),
      behavior: SnackBarBehavior.floating,
      backgroundColor: const Color(0xEE1E2630),
      shape: const StadiumBorder(),
      margin: const EdgeInsets.fromLTRB(40, 0, 40, 110),
      duration: const Duration(milliseconds: 2400),
    ));
}

/// iOS-like page transition: slide + fade with a spring
Route<T> glassRoute<T>(Widget page) => PageRouteBuilder<T>(
      transitionDuration: const Duration(milliseconds: 520),
      reverseTransitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (_, __, ___) => page,
      transitionsBuilder: (_, a, __, child) {
        final c = CurvedAnimation(parent: a, curve: const Cubic(.2, 1, .3, 1), reverseCurve: Curves.easeIn);
        return FadeTransition(opacity: c, child: SlideTransition(position: Tween(begin: const Offset(.12, 0), end: Offset.zero).animate(c), child: child));
      },
    );

/// iOS-like scroll edge: content scrolling under the status bar gets blurred and dimmed
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
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
              child: Container(color: const Color(0x8C0B1016)),
            ),
          ),
        ),
      ),
    );
  }
}
