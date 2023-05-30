(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.tinycolor = factory());
})(this, (function () { 'use strict';

  function _typeof(obj) {
    "@babel/helpers - typeof";

    return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
      return typeof obj;
    } : function (obj) {
      return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
    }, _typeof(obj);
  }

  // https://github.com/bgrins/TinyColor
  // Brian Grinstead, MIT License

  var trimLeft = /^\s+/;
  var trimRight = /\s+$/;
  function tinycolor(color, opts) {
    color = color ? color : "";
    opts = opts || {};

    // If input is already a tinycolor, return itself
    if (color instanceof tinycolor) {
      return color;
    }
    // If we are called as a function, call using new instead
    if (!(this instanceof tinycolor)) {
      return new tinycolor(color, opts);
    }
    var rgb = inputToRGB(color);
    this._originalInput = color, this._r = rgb.r, this._g = rgb.g, this._b = rgb.b, this._a = rgb.a, this._roundA = Math.round(100 * this._a) / 100, this._format = opts.format || rgb.format;
    this._gradientType = opts.gradientType;

    // Don't let the range of [0,255] come back in [0,1].
    // Potentially lose a little bit of precision here, but will fix issues where
    // .5 gets interpreted as half of the total, instead of half of 1
    // If it was supposed to be 128, this was already taken care of by `inputToRgb`
    if (this._r < 1) this._r = Math.round(this._r);
    if (this._g < 1) this._g = Math.round(this._g);
    if (this._b < 1) this._b = Math.round(this._b);
    this._ok = rgb.ok;
  }
  tinycolor.prototype = {
    isDark: function isDark() {
      return this.getBrightness() < 128;
    },
    isLight: function isLight() {
      return !this.isDark();
    },
    isValid: function isValid() {
      return this._ok;
    },
    getOriginalInput: function getOriginalInput() {
      return this._originalInput;
    },
    getFormat: function getFormat() {
      return this._format;
    },
    getAlpha: function getAlpha() {
      return this._a;
    },
    getBrightness: function getBrightness() {
      //http://www.w3.org/TR/AERT#color-contrast
      var rgb = this.toRgb();
      return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    },
    getLuminance: function getLuminance() {
      //http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
      var rgb = this.toRgb();
      var RsRGB, GsRGB, BsRGB, R, G, B;
      RsRGB = rgb.r / 255;
      GsRGB = rgb.g / 255;
      BsRGB = rgb.b / 255;
      if (RsRGB <= 0.03928) R = RsRGB / 12.92;else R = Math.pow((RsRGB + 0.055) / 1.055, 2.4);
      if (GsRGB <= 0.03928) G = GsRGB / 12.92;else G = Math.pow((GsRGB + 0.055) / 1.055, 2.4);
      if (BsRGB <= 0.03928) B = BsRGB / 12.92;else B = Math.pow((BsRGB + 0.055) / 1.055, 2.4);
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    },
    setAlpha: function setAlpha(value) {
      this._a = boundAlpha(value);
      this._roundA = Math.round(100 * this._a) / 100;
      return this;
    },
    toHsv: function toHsv() {
      var hsv = rgbToHsv(this._r, this._g, this._b);
      return {
        h: hsv.h * 360,
        s: hsv.s,
        v: hsv.v,
        a: this._a
      };
    },
    toHsvString: function toHsvString() {
      var hsv = rgbToHsv(this._r, this._g, this._b);
      var h = Math.round(hsv.h * 360),
        s = Math.round(hsv.s * 100),
        v = Math.round(hsv.v * 100);
      return this._a == 1 ? "hsv(" + h + ", " + s + "%, " + v + "%)" : "hsva(" + h + ", " + s + "%, " + v + "%, " + this._roundA + ")";
    },
    toHsl: function toHsl() {
      var hsl = rgbToHsl(this._r, this._g, this._b);
      return {
        h: hsl.h * 360,
        s: hsl.s,
        l: hsl.l,
        a: this._a
      };
    },
    toHslString: function toHslString() {
      var hsl = rgbToHsl(this._r, this._g, this._b);
      var h = Math.round(hsl.h * 360),
        s = Math.round(hsl.s * 100),
        l = Math.round(hsl.l * 100);
      return this._a == 1 ? "hsl(" + h + ", " + s + "%, " + l + "%)" : "hsla(" + h + ", " + s + "%, " + l + "%, " + this._roundA + ")";
    },
    toHex: function toHex(allow3Char) {
      return rgbToHex(this._r, this._g, this._b, allow3Char);
    },
    toHexString: function toHexString(allow3Char) {
      return "#" + this.toHex(allow3Char);
    },
    toHexNumber: function toHexNumber() {
      return Number("0x" + this.toHex());
    },
    toHex8: function toHex8(allow4Char) {
      return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
    },
    toHex8String: function toHex8String(allow4Char) {
      return "#" + this.toHex8(allow4Char);
    },
    toRgb: function toRgb() {
      return {
        r: Math.round(this._r),
        g: Math.round(this._g),
        b: Math.round(this._b),
        a: this._a
      };
    },
    toRgbString: function toRgbString() {
      return this._a == 1 ? "rgb(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ")" : "rgba(" + Math.round(this._r) + ", " + Math.round(this._g) + ", " + Math.round(this._b) + ", " + this._roundA + ")";
    },
    toPercentageRgb: function toPercentageRgb() {
      return {
        r: Math.round(bound01(this._r, 255) * 100) + "%",
        g: Math.round(bound01(this._g, 255) * 100) + "%",
        b: Math.round(bound01(this._b, 255) * 100) + "%",
        a: this._a
      };
    },
    toPercentageRgbString: function toPercentageRgbString() {
      return this._a == 1 ? "rgb(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%)" : "rgba(" + Math.round(bound01(this._r, 255) * 100) + "%, " + Math.round(bound01(this._g, 255) * 100) + "%, " + Math.round(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
    },
    toName: function toName() {
      if (this._a === 0) {
        return "transparent";
      }
      if (this._a < 1) {
        return false;
      }
      return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
    },
    toFilter: function toFilter(secondColor) {
      var hex8String = "#" + rgbaToArgbHex(this._r, this._g, this._b, this._a);
      var secondHex8String = hex8String;
      var gradientType = this._gradientType ? "GradientType = 1, " : "";
      if (secondColor) {
        var s = tinycolor(secondColor);
        secondHex8String = "#" + rgbaToArgbHex(s._r, s._g, s._b, s._a);
      }
      return "progid:DXImageTransform.Microsoft.gradient(" + gradientType + "startColorstr=" + hex8String + ",endColorstr=" + secondHex8String + ")";
    },
    toString: function toString(format) {
      var formatSet = !!format;
      format = format || this._format;
      var formattedString = false;
      var hasAlpha = this._a < 1 && this._a >= 0;
      var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name");
      if (needsAlphaFormat) {
        // Special case for "transparent", all other non-alpha formats
        // will return rgba when there is transparency.
        if (format === "name" && this._a === 0) {
          return this.toName();
        }
        return this.toRgbString();
      }
      if (format === "rgb") {
        formattedString = this.toRgbString();
      }
      if (format === "prgb") {
        formattedString = this.toPercentageRgbString();
      }
      if (format === "hex" || format === "hex6") {
        formattedString = this.toHexString();
      }
      if (format === "hex3") {
        formattedString = this.toHexString(true);
      }
      if (format === "hex4") {
        formattedString = this.toHex8String(true);
      }
      if (format === "hex8") {
        formattedString = this.toHex8String();
      }
      if (format === "name") {
        formattedString = this.toName();
      }
      if (format === "hsl") {
        formattedString = this.toHslString();
      }
      if (format === "hsv") {
        formattedString = this.toHsvString();
      }
      return formattedString || this.toHexString();
    },
    clone: function clone() {
      return tinycolor(this.toString());
    },
    _applyModification: function _applyModification(fn, args) {
      var color = fn.apply(null, [this].concat([].slice.call(args)));
      this._r = color._r;
      this._g = color._g;
      this._b = color._b;
      this.setAlpha(color._a);
      return this;
    },
    lighten: function lighten() {
      return this._applyModification(_lighten, arguments);
    },
    brighten: function brighten() {
      return this._applyModification(_brighten, arguments);
    },
    darken: function darken() {
      return this._applyModification(_darken, arguments);
    },
    desaturate: function desaturate() {
      return this._applyModification(_desaturate, arguments);
    },
    saturate: function saturate() {
      return this._applyModification(_saturate, arguments);
    },
    greyscale: function greyscale() {
      return this._applyModification(_greyscale, arguments);
    },
    spin: function spin() {
      return this._applyModification(_spin, arguments);
    },
    _applyCombination: function _applyCombination(fn, args) {
      return fn.apply(null, [this].concat([].slice.call(args)));
    },
    analogous: function analogous() {
      return this._applyCombination(_analogous, arguments);
    },
    complement: function complement() {
      return this._applyCombination(_complement, arguments);
    },
    monochromatic: function monochromatic() {
      return this._applyCombination(_monochromatic, arguments);
    },
    splitcomplement: function splitcomplement() {
      return this._applyCombination(_splitcomplement, arguments);
    },
    // Disabled until https://github.com/bgrins/TinyColor/issues/254
    // polyad: function (number) {
    //   return this._applyCombination(polyad, [number]);
    // },
    triad: function triad() {
      return this._applyCombination(polyad, [3]);
    },
    tetrad: function tetrad() {
      return this._applyCombination(polyad, [4]);
    }
  };

  // If input is an object, force 1 into "1.0" to handle ratios properly
  // String input requires "1.0" as input, so 1 will be treated as 1
  tinycolor.fromRatio = function (color, opts) {
    if (_typeof(color) == "object") {
      var newColor = {};
      for (var i in color) {
        if (color.hasOwnProperty(i)) {
          if (i === "a") {
            newColor[i] = color[i];
          } else {
            newColor[i] = convertToPercentage(color[i]);
          }
        }
      }
      color = newColor;
    }
    return tinycolor(color, opts);
  };

  // Given a string or object, convert that input to RGB
  // Possible string inputs:
  //
  //     "red"
  //     "#f00" or "f00"
  //     "#ff0000" or "ff0000"
  //     "#ff000000" or "ff000000"
  //     "rgb 255 0 0" or "rgb (255, 0, 0)"
  //     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
  //     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
  //     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
  //     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
  //     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
  //     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
  //
  function inputToRGB(color) {
    var rgb = {
      r: 0,
      g: 0,
      b: 0
    };
    var a = 1;
    var s = null;
    var v = null;
    var l = null;
    var ok = false;
    var format = false;
    if (typeof color == "string") {
      color = stringInputToObject(color);
    }
    if (_typeof(color) == "object") {
      if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
        rgb = rgbToRgb(color.r, color.g, color.b);
        ok = true;
        format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
      } else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
        s = convertToPercentage(color.s);
        v = convertToPercentage(color.v);
        rgb = hsvToRgb(color.h, s, v);
        ok = true;
        format = "hsv";
      } else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
        s = convertToPercentage(color.s);
        l = convertToPercentage(color.l);
        rgb = hslToRgb(color.h, s, l);
        ok = true;
        format = "hsl";
      }
      if (color.hasOwnProperty("a")) {
        a = color.a;
      }
    }
    a = boundAlpha(a);
    return {
      ok: ok,
      format: color.format || format,
      r: Math.min(255, Math.max(rgb.r, 0)),
      g: Math.min(255, Math.max(rgb.g, 0)),
      b: Math.min(255, Math.max(rgb.b, 0)),
      a: a
    };
  }

  // Conversion Functions
  // --------------------

  // `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
  // <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

  // `rgbToRgb`
  // Handle bounds / percentage checking to conform to CSS color spec
  // <http://www.w3.org/TR/css3-color/>
  // *Assumes:* r, g, b in [0, 255] or [0, 1]
  // *Returns:* { r, g, b } in [0, 255]
  function rgbToRgb(r, g, b) {
    return {
      r: bound01(r, 255) * 255,
      g: bound01(g, 255) * 255,
      b: bound01(b, 255) * 255
    };
  }

  // `rgbToHsl`
  // Converts an RGB color value to HSL.
  // *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
  // *Returns:* { h, s, l } in [0,1]
  function rgbToHsl(r, g, b) {
    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);
    var max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    var h,
      s,
      l = (max + min) / 2;
    if (max == min) {
      h = s = 0; // achromatic
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: h,
      s: s,
      l: l
    };
  }

  // `hslToRgb`
  // Converts an HSL color value to RGB.
  // *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
  // *Returns:* { r, g, b } in the set [0, 255]
  function hslToRgb(h, s, l) {
    var r, g, b;
    h = bound01(h, 360);
    s = bound01(s, 100);
    l = bound01(l, 100);
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
      r: r * 255,
      g: g * 255,
      b: b * 255
    };
  }

  // `rgbToHsv`
  // Converts an RGB color value to HSV
  // *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
  // *Returns:* { h, s, v } in [0,1]
  function rgbToHsv(r, g, b) {
    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);
    var max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    var h,
      s,
      v = max;
    var d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max == min) {
      h = 0; // achromatic
    } else {
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }
    return {
      h: h,
      s: s,
      v: v
    };
  }

  // `hsvToRgb`
  // Converts an HSV color value to RGB.
  // *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
  // *Returns:* { r, g, b } in the set [0, 255]
  function hsvToRgb(h, s, v) {
    h = bound01(h, 360) * 6;
    s = bound01(s, 100);
    v = bound01(v, 100);
    var i = Math.floor(h),
      f = h - i,
      p = v * (1 - s),
      q = v * (1 - f * s),
      t = v * (1 - (1 - f) * s),
      mod = i % 6,
      r = [v, q, p, p, t, v][mod],
      g = [t, v, v, q, p, p][mod],
      b = [p, p, t, v, v, q][mod];
    return {
      r: r * 255,
      g: g * 255,
      b: b * 255
    };
  }

  // `rgbToHex`
  // Converts an RGB color to hex
  // Assumes r, g, and b are contained in the set [0, 255]
  // Returns a 3 or 6 character hex
  function rgbToHex(r, g, b, allow3Char) {
    var hex = [pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b).toString(16))];

    // Return a 3 character hex if possible
    if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
      return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
    }
    return hex.join("");
  }

  // `rgbaToHex`
  // Converts an RGBA color plus alpha transparency to hex
  // Assumes r, g, b are contained in the set [0, 255] and
  // a in [0, 1]. Returns a 4 or 8 character rgba hex
  function rgbaToHex(r, g, b, a, allow4Char) {
    var hex = [pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b).toString(16)), pad2(convertDecimalToHex(a))];

    // Return a 4 character hex if possible
    if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) {
      return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
    }
    return hex.join("");
  }

  // `rgbaToArgbHex`
  // Converts an RGBA color to an ARGB Hex8 string
  // Rarely used, but required for "toFilter()"
  function rgbaToArgbHex(r, g, b, a) {
    var hex = [pad2(convertDecimalToHex(a)), pad2(Math.round(r).toString(16)), pad2(Math.round(g).toString(16)), pad2(Math.round(b).toString(16))];
    return hex.join("");
  }

  // `equals`
  // Can be called with any tinycolor input
  tinycolor.equals = function (color1, color2) {
    if (!color1 || !color2) return false;
    return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
  };
  tinycolor.random = function () {
    return tinycolor.fromRatio({
      r: Math.random(),
      g: Math.random(),
      b: Math.random()
    });
  };

  // Modification Functions
  // ----------------------
  // Thanks to less.js for some of the basics here
  // <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

  function _desaturate(color, amount) {
    amount = amount === 0 ? 0 : amount || 10;
    var hsl = tinycolor(color).toHsl();
    hsl.s -= amount / 100;
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
  }
  function _saturate(color, amount) {
    amount = amount === 0 ? 0 : amount || 10;
    var hsl = tinycolor(color).toHsl();
    hsl.s += amount / 100;
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
  }
  function _greyscale(color) {
    return tinycolor(color).desaturate(100);
  }
  function _lighten(color, amount) {
    amount = amount === 0 ? 0 : amount || 10;
    var hsl = tinycolor(color).toHsl();
    hsl.l += amount / 100;
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
  }
  function _brighten(color, amount) {
    amount = amount === 0 ? 0 : amount || 10;
    var rgb = tinycolor(color).toRgb();
    rgb.r = Math.max(0, Math.min(255, rgb.r - Math.round(255 * -(amount / 100))));
    rgb.g = Math.max(0, Math.min(255, rgb.g - Math.round(255 * -(amount / 100))));
    rgb.b = Math.max(0, Math.min(255, rgb.b - Math.round(255 * -(amount / 100))));
    return tinycolor(rgb);
  }
  function _darken(color, amount) {
    amount = amount === 0 ? 0 : amount || 10;
    var hsl = tinycolor(color).toHsl();
    hsl.l -= amount / 100;
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
  }

  // Spin takes a positive or negative amount within [-360, 360] indicating the change of hue.
  // Values outside of this range will be wrapped into this range.
  function _spin(color, amount) {
    var hsl = tinycolor(color).toHsl();
    var hue = (hsl.h + amount) % 360;
    hsl.h = hue < 0 ? 360 + hue : hue;
    return tinycolor(hsl);
  }

  // Combination Functions
  // ---------------------
  // Thanks to jQuery xColor for some of the ideas behind these
  // <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

  function _complement(color) {
    var hsl = tinycolor(color).toHsl();
    hsl.h = (hsl.h + 180) % 360;
    return tinycolor(hsl);
  }
  function polyad(color, number) {
    if (isNaN(number) || number <= 0) {
      throw new Error("Argument to polyad must be a positive number");
    }
    var hsl = tinycolor(color).toHsl();
    var result = [tinycolor(color)];
    var step = 360 / number;
    for (var i = 1; i < number; i++) {
      result.push(tinycolor({
        h: (hsl.h + i * step) % 360,
        s: hsl.s,
        l: hsl.l
      }));
    }
    return result;
  }
  function _splitcomplement(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [tinycolor(color), tinycolor({
      h: (h + 72) % 360,
      s: hsl.s,
      l: hsl.l
    }), tinycolor({
      h: (h + 216) % 360,
      s: hsl.s,
      l: hsl.l
    })];
  }
  function _analogous(color, results, slices) {
    results = results || 6;
    slices = slices || 30;
    var hsl = tinycolor(color).toHsl();
    var part = 360 / slices;
    var ret = [tinycolor(color)];
    for (hsl.h = (hsl.h - (part * results >> 1) + 720) % 360; --results;) {
      hsl.h = (hsl.h + part) % 360;
      ret.push(tinycolor(hsl));
    }
    return ret;
  }
  function _monochromatic(color, results) {
    results = results || 6;
    var hsv = tinycolor(color).toHsv();
    var h = hsv.h,
      s = hsv.s,
      v = hsv.v;
    var ret = [];
    var modification = 1 / results;
    while (results--) {
      ret.push(tinycolor({
        h: h,
        s: s,
        v: v
      }));
      v = (v + modification) % 1;
    }
    return ret;
  }



  // Utility Functions
  // ---------------------

  tinycolor.mix = function (color1, color2, amount) {
    amount = amount === 0 ? 0 : amount || 50;
    var rgb1 = tinycolor(color1).toRgb();
    var rgb2 = tinycolor(color2).toRgb();
    var p = amount / 100;
    var rgba = {
      r: (rgb2.r - rgb1.r) * p + rgb1.r,
      g: (rgb2.g - rgb1.g) * p + rgb1.g,
      b: (rgb2.b - rgb1.b) * p + rgb1.b,
      a: (rgb2.a - rgb1.a) * p + rgb1.a
    };
    return tinycolor(rgba);
  };

  // Readability Functions
  // ---------------------
  // <http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef (WCAG Version 2)

  // `contrast`
  // Analyze the 2 colors and returns the color contrast defined by (WCAG Version 2)
  tinycolor.readability = function (color1, color2) {
    var c1 = tinycolor(color1);
    var c2 = tinycolor(color2);
    return (Math.max(c1.getLuminance(), c2.getLuminance()) + 0.05) / (Math.min(c1.getLuminance(), c2.getLuminance()) + 0.05);
  };

  // `isReadable`
  // Ensure that foreground and background color combinations meet WCAG2 guidelines.
  // The third argument is an optional Object.
  //      the 'level' property states 'AA' or 'AAA' - if missing or invalid, it defaults to 'AA';
  //      the 'size' property states 'large' or 'small' - if missing or invalid, it defaults to 'small'.
  // If the entire object is absent, isReadable defaults to {level:"AA",size:"small"}.

  // *Example*
  //    tinycolor.isReadable("#000", "#111") => false
  //    tinycolor.isReadable("#000", "#111",{level:"AA",size:"large"}) => false
  tinycolor.isReadable = function (color1, color2, wcag2) {
    var readability = tinycolor.readability(color1, color2);
    var wcag2Parms, out;
    out = false;
    wcag2Parms = validateWCAG2Parms(wcag2);
    switch (wcag2Parms.level + wcag2Parms.size) {
      case "AAsmall":
      case "AAAlarge":
        out = readability >= 4.5;
        break;
      case "AAlarge":
        out = readability >= 3;
        break;
      case "AAAsmall":
        out = readability >= 7;
        break;
    }
    return out;
  };

  // `mostReadable`
  // Given a base color and a list of possible foreground or background
  // colors for that base, returns the most readable color.
  // Optionally returns Black or White if the most readable color is unreadable.
  // *Example*
  //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:false}).toHexString(); // "#112255"
  //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:true}).toHexString();  // "#ffffff"
  //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"large"}).toHexString(); // "#faf3f3"
  //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"small"}).toHexString(); // "#ffffff"
  tinycolor.mostReadable = function (baseColor, colorList, args) {
    var bestColor = null;
    var bestScore = 0;
    var readability;
    var includeFallbackColors, level, size;
    args = args || {};
    includeFallbackColors = args.includeFallbackColors;
    level = args.level;
    size = args.size;
    for (var i = 0; i < colorList.length; i++) {
      readability = tinycolor.readability(baseColor, colorList[i]);
      if (readability > bestScore) {
        bestScore = readability;
        bestColor = tinycolor(colorList[i]);
      }
    }
    if (tinycolor.isReadable(baseColor, bestColor, {
      level: level,
      size: size
    }) || !includeFallbackColors) {
      return bestColor;
    } else {
      args.includeFallbackColors = false;
      return tinycolor.mostReadable(baseColor, ["#fff", "#000"], args);
    }
  };

  // Big List of Colors
  // ------------------
  // <https://www.w3.org/TR/css-color-4/#named-colors>
  var names = tinycolor.names = {
    aliceblue: "f0f8ff",
    antiquewhite: "faebd7",
    aqua: "0ff",
    aquamarine: "7fffd4",
    azure: "f0ffff",
    beige: "f5f5dc",
    bisque: "ffe4c4",
    black: "000",
    blanchedalmond: "ffebcd",
    blue: "00f",
    blueviolet: "8a2be2",
    brown: "a52a2a",
    burlywood: "deb887",
    burntsienna: "ea7e5d",
    cadetblue: "5f9ea0",
    chartreuse: "7fff00",
    chocolate: "d2691e",
    coral: "ff7f50",
    cornflowerblue: "6495ed",
    cornsilk: "fff8dc",
    crimson: "dc143c",
    cyan: "0ff",
    darkblue: "00008b",
    darkcyan: "008b8b",
    darkgoldenrod: "b8860b",
    darkgray: "a9a9a9",
    darkgreen: "006400",
    darkgrey: "a9a9a9",
    darkkhaki: "bdb76b",
    darkmagenta: "8b008b",
    darkolivegreen: "556b2f",
    darkorange: "ff8c00",
    darkorchid: "9932cc",
    darkred: "8b0000",
    darksalmon: "e9967a",
    darkseagreen: "8fbc8f",
    darkslateblue: "483d8b",
    darkslategray: "2f4f4f",
    darkslategrey: "2f4f4f",
    darkturquoise: "00ced1",
    darkviolet: "9400d3",
    deeppink: "ff1493",
    deepskyblue: "00bfff",
    dimgray: "696969",
    dimgrey: "696969",
    dodgerblue: "1e90ff",
    firebrick: "b22222",
    floralwhite: "fffaf0",
    forestgreen: "228b22",
    fuchsia: "f0f",
    gainsboro: "dcdcdc",
    ghostwhite: "f8f8ff",
    gold: "ffd700",
    goldenrod: "daa520",
    gray: "808080",
    green: "008000",
    greenyellow: "adff2f",
    grey: "808080",
    honeydew: "f0fff0",
    hotpink: "ff69b4",
    indianred: "cd5c5c",
    indigo: "4b0082",
    ivory: "fffff0",
    khaki: "f0e68c",
    lavender: "e6e6fa",
    lavenderblush: "fff0f5",
    lawngreen: "7cfc00",
    lemonchiffon: "fffacd",
    lightblue: "add8e6",
    lightcoral: "f08080",
    lightcyan: "e0ffff",
    lightgoldenrodyellow: "fafad2",
    lightgray: "d3d3d3",
    lightgreen: "90ee90",
    lightgrey: "d3d3d3",
    lightpink: "ffb6c1",
    lightsalmon: "ffa07a",
    lightseagreen: "20b2aa",
    lightskyblue: "87cefa",
    lightslategray: "789",
    lightslategrey: "789",
    lightsteelblue: "b0c4de",
    lightyellow: "ffffe0",
    lime: "0f0",
    limegreen: "32cd32",
    linen: "faf0e6",
    magenta: "f0f",
    maroon: "800000",
    mediumaquamarine: "66cdaa",
    mediumblue: "0000cd",
    mediumorchid: "ba55d3",
    mediumpurple: "9370db",
    mediumseagreen: "3cb371",
    mediumslateblue: "7b68ee",
    mediumspringgreen: "00fa9a",
    mediumturquoise: "48d1cc",
    mediumvioletred: "c71585",
    midnightblue: "191970",
    mintcream: "f5fffa",
    mistyrose: "ffe4e1",
    moccasin: "ffe4b5",
    navajowhite: "ffdead",
    navy: "000080",
    oldlace: "fdf5e6",
    olive: "808000",
    olivedrab: "6b8e23",
    orange: "ffa500",
    orangered: "ff4500",
    orchid: "da70d6",
    palegoldenrod: "eee8aa",
    palegreen: "98fb98",
    paleturquoise: "afeeee",
    palevioletred: "db7093",
    papayawhip: "ffefd5",
    peachpuff: "ffdab9",
    peru: "cd853f",
    pink: "ffc0cb",
    plum: "dda0dd",
    powderblue: "b0e0e6",
    purple: "800080",
    rebeccapurple: "663399",
    red: "f00",
    rosybrown: "bc8f8f",
    royalblue: "4169e1",
    saddlebrown: "8b4513",
    salmon: "fa8072",
    sandybrown: "f4a460",
    seagreen: "2e8b57",
    seashell: "fff5ee",
    sienna: "a0522d",
    silver: "c0c0c0",
    skyblue: "87ceeb",
    slateblue: "6a5acd",
    slategray: "708090",
    slategrey: "708090",
    snow: "fffafa",
    springgreen: "00ff7f",
    steelblue: "4682b4",
    tan: "d2b48c",
    teal: "008080",
    thistle: "d8bfd8",
    tomato: "ff6347",
    turquoise: "40e0d0",
    violet: "ee82ee",
    wheat: "f5deb3",
    white: "fff",
    whitesmoke: "f5f5f5",
    yellow: "ff0",
    yellowgreen: "9acd32"
  };

  // Make it easy to access colors via `hexNames[hex]`
  var hexNames = tinycolor.hexNames = flip(names);

  // Utilities
  // ---------

  // `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
  function flip(o) {
    var flipped = {};
    for (var i in o) {
      if (o.hasOwnProperty(i)) {
        flipped[o[i]] = i;
      }
    }
    return flipped;
  }

  // Return a valid alpha value [0,1] with all invalid values being set to 1
  function boundAlpha(a) {
    a = parseFloat(a);
    if (isNaN(a) || a < 0 || a > 1) {
      a = 1;
    }
    return a;
  }

  // Take input from [0, n] and return it as [0, 1]
  function bound01(n, max) {
    if (isOnePointZero(n)) n = "100%";
    var processPercent = isPercentage(n);
    n = Math.min(max, Math.max(0, parseFloat(n)));

    // Automatically convert percentage into number
    if (processPercent) {
      n = parseInt(n * max, 10) / 100;
    }

    // Handle floating point rounding errors
    if (Math.abs(n - max) < 0.000001) {
      return 1;
    }

    // Convert into [0, 1] range if it isn't already
    return n % max / parseFloat(max);
  }

  // Force a number between 0 and 1
  function clamp01(val) {
    return Math.min(1, Math.max(0, val));
  }

  // Parse a base-16 hex value into a base-10 integer
  function parseIntFromHex(val) {
    return parseInt(val, 16);
  }

  // Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
  // <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
  function isOnePointZero(n) {
    return typeof n == "string" && n.indexOf(".") != -1 && parseFloat(n) === 1;
  }

  // Check to see if string passed in is a percentage
  function isPercentage(n) {
    return typeof n === "string" && n.indexOf("%") != -1;
  }

  // Force a hex value to have 2 characters
  function pad2(c) {
    return c.length == 1 ? "0" + c : "" + c;
  }

  // Replace a decimal with it's percentage value
  function convertToPercentage(n) {
    if (n <= 1) {
      n = n * 100 + "%";
    }
    return n;
  }

  // Converts a decimal to a hex value
  function convertDecimalToHex(d) {
    return Math.round(parseFloat(d) * 255).toString(16);
  }
  // Converts a hex value to a decimal
  function convertHexToDecimal(h) {
    return parseIntFromHex(h) / 255;
  }
  var matchers = function () {
    // <http://www.w3.org/TR/css3-values/#integers>
    var CSS_INTEGER = "[-\\+]?\\d+%?";

    // <http://www.w3.org/TR/css3-values/#number-value>
    var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

    // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
    var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

    // Actual matching.
    // Parentheses and commas are optional, but not required.
    // Whitespace can take the place of commas or opening paren
    var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
    var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
    return {
      CSS_UNIT: new RegExp(CSS_UNIT),
      rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
      rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
      hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
      hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
      hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
      hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
      hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
      hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
      hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
      hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
    };
  }();

  // `isValidCSSUnit`
  // Take in a single string / number and check to see if it looks like a CSS unit
  // (see `matchers` above for definition).
  function isValidCSSUnit(color) {
    return !!matchers.CSS_UNIT.exec(color);
  }

  // `stringInputToObject`
  // Permissive string parsing.  Take in a number of formats, and output an object
  // based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
  function stringInputToObject(color) {
    color = color.replace(trimLeft, "").replace(trimRight, "").toLowerCase();
    var named = false;
    if (names[color]) {
      color = names[color];
      named = true;
    } else if (color == "transparent") {
      return {
        r: 0,
        g: 0,
        b: 0,
        a: 0,
        format: "name"
      };
    }

    // Try to match string input using regular expressions.
    // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
    // Just return an object and let the conversion functions handle that.
    // This way the result will be the same whether the tinycolor is initialized with string or object.
    var match;
    if (match = matchers.rgb.exec(color)) {
      return {
        r: match[1],
        g: match[2],
        b: match[3]
      };
    }
    if (match = matchers.rgba.exec(color)) {
      return {
        r: match[1],
        g: match[2],
        b: match[3],
        a: match[4]
      };
    }
    if (match = matchers.hsl.exec(color)) {
      return {
        h: match[1],
        s: match[2],
        l: match[3]
      };
    }
    if (match = matchers.hsla.exec(color)) {
      return {
        h: match[1],
        s: match[2],
        l: match[3],
        a: match[4]
      };
    }
    if (match = matchers.hsv.exec(color)) {
      return {
        h: match[1],
        s: match[2],
        v: match[3]
      };
    }
    if (match = matchers.hsva.exec(color)) {
      return {
        h: match[1],
        s: match[2],
        v: match[3],
        a: match[4]
      };
    }
    if (match = matchers.hex8.exec(color)) {
      return {
        r: parseIntFromHex(match[1]),
        g: parseIntFromHex(match[2]),
        b: parseIntFromHex(match[3]),
        a: convertHexToDecimal(match[4]),
        format: named ? "name" : "hex8"
      };
    }
    if (match = matchers.hex6.exec(color)) {
      return {
        r: parseIntFromHex(match[1]),
        g: parseIntFromHex(match[2]),
        b: parseIntFromHex(match[3]),
        format: named ? "name" : "hex"
      };
    }
    if (match = matchers.hex4.exec(color)) {
      return {
        r: parseIntFromHex(match[1] + "" + match[1]),
        g: parseIntFromHex(match[2] + "" + match[2]),
        b: parseIntFromHex(match[3] + "" + match[3]),
        a: convertHexToDecimal(match[4] + "" + match[4]),
        format: named ? "name" : "hex8"
      };
    }
    if (match = matchers.hex3.exec(color)) {
      return {
        r: parseIntFromHex(match[1] + "" + match[1]),
        g: parseIntFromHex(match[2] + "" + match[2]),
        b: parseIntFromHex(match[3] + "" + match[3]),
        format: named ? "name" : "hex"
      };
    }
    return false;
  }
  function validateWCAG2Parms(parms) {
    // return valid WCAG2 parms for isReadable.
    // If input parms are invalid, return {"level":"AA", "size":"small"}
    var level, size;
    parms = parms || {
      level: "AA",
      size: "small"
    };
    level = (parms.level || "AA").toUpperCase();
    size = (parms.size || "small").toLowerCase();
    if (level !== "AA" && level !== "AAA") {
      level = "AA";
    }
    if (size !== "small" && size !== "large") {
      size = "small";
    }
    return {
      level: level,
      size: size
    };
  }

  return tinycolor;

}));


// w3color.js

/* w3color.js ver.1.18 by w3schools.com (Do not remove this line)*/


function w3color(color, elmnt) {
  if (!(this instanceof w3color)) { return new w3color(color, elmnt); }
  if (typeof color == "object") { return color; }
  this.attachValues(toColorObject(color));
  if (elmnt) { elmnt.style.backgroundColor = this.toRgbString(); }
}

w3color.prototype = {
  toRgbString: function () {
      return "rgb(" + this.red + ", " + this.green + ", " + this.blue + ")";
  },
  toRgbaString: function () {
      return "rgba(" + this.red + ", " + this.green + ", " + this.blue + ", " + this.opacity + ")";
  },
  toHwbString: function () {
      return "hwb(" + this.hue + ", " + Math.round(this.whiteness * 100) + "%, " + Math.round(this.blackness * 100) + "%)";
  },
  toHwbStringDecimal: function () {
      return "hwb(" + this.hue + ", " + this.whiteness + ", " + this.blackness + ")";
  },
  toHwbaString: function () {
      return "hwba(" + this.hue + ", " + Math.round(this.whiteness * 100) + "%, " + Math.round(this.blackness * 100) + "%, " + this.opacity + ")";
  },
  toHslString: function () {
      return "hsl(" + this.hue + ", " + Math.round(this.sat * 100) + "%, " + Math.round(this.lightness * 100) + "%)";
  },
  toHslStringDecimal: function () {
      return "hsl(" + this.hue + ", " + this.sat + ", " + this.lightness + ")";
  },
  toHslaString: function () {
      return "hsla(" + this.hue + ", " + Math.round(this.sat * 100) + "%, " + Math.round(this.lightness * 100) + "%, " + this.opacity + ")";
  },
  toCmykString: function () {
      return "cmyk(" + Math.round(this.cyan * 100) + "%, " + Math.round(this.magenta * 100) + "%, " + Math.round(this.yellow * 100) + "%, " + Math.round(this.black * 100) + "%)";
  },
  toCmykStringDecimal: function () {
      return "cmyk(" + this.cyan + ", " + this.magenta + ", " + this.yellow + ", " + this.black + ")";
  },
  toNcolString: function () {
      return this.ncol + ", " + Math.round(this.whiteness * 100) + "%, " + Math.round(this.blackness * 100) + "%";
  },
  toNcolStringDecimal: function () {
      return this.ncol + ", " + this.whiteness + ", " + this.blackness;
  },
  toNcolaString: function () {
      return this.ncol + ", " + Math.round(this.whiteness * 100) + "%, " + Math.round(this.blackness * 100) + "%, " + this.opacity;
  },
  toName: function () {
      var r, g, b, colorhexs = getColorArr('hexs');
      for (i = 0; i < colorhexs.length; i++) {
          r = parseInt(colorhexs[i].substr(0, 2), 16);
          g = parseInt(colorhexs[i].substr(2, 2), 16);
          b = parseInt(colorhexs[i].substr(4, 2), 16);
          if (this.red == r && this.green == g && this.blue == b) {
              return getColorArr('names')[i];
          }
      }
      return "";
  },
  toHexString: function () {
      var r = toHex(this.red);
      var g = toHex(this.green);
      var b = toHex(this.blue);
      return "#" + r + g + b;
  },
  toRgb: function () {
      return { r: this.red, g: this.green, b: this.blue, a: this.opacity };
  },
  toHsl: function () {
      return { h: this.hue, s: this.sat, l: this.lightness, a: this.opacity };
  },
  toHwb: function () {
      return { h: this.hue, w: this.whiteness, b: this.blackness, a: this.opacity };
  },
  toCmyk: function () {
      return { c: this.cyan, m: this.magenta, y: this.yellow, k: this.black, a: this.opacity };
  },
  toNcol: function () {
      return { ncol: this.ncol, w: this.whiteness, b: this.blackness, a: this.opacity };
  },
  isDark: function (n) {
      var m = (n || 128);
      return (((this.red * 299 + this.green * 587 + this.blue * 114) / 1000) < m);
  },
  saturate: function (n) {
      var x, rgb, color;
      x = (n / 100 || 0.1);
      this.sat += x;
      if (this.sat > 1) { this.sat = 1; }
      rgb = hslToRgb(this.hue, this.sat, this.lightness);
      color = colorObject(rgb, this.opacity, this.hue, this.sat);
      this.attachValues(color);
  },
  desaturate: function (n) {
      var x, rgb, color;
      x = (n / 100 || 0.1);
      this.sat -= x;
      if (this.sat < 0) { this.sat = 0; }
      rgb = hslToRgb(this.hue, this.sat, this.lightness);
      color = colorObject(rgb, this.opacity, this.hue, this.sat);
      this.attachValues(color);
  },
  lighter: function (n) {
      var x, rgb, color;
      x = (n / 100 || 0.1);
      this.lightness += x;
      if (this.lightness > 1) { this.lightness = 1; }
      rgb = hslToRgb(this.hue, this.sat, this.lightness);
      color = colorObject(rgb, this.opacity, this.hue, this.sat);
      this.attachValues(color);
  },
  darker: function (n) {
      var x, rgb, color;
      x = (n / 100 || 0.1);
      this.lightness -= x;
      if (this.lightness < 0) { this.lightness = 0; }
      rgb = hslToRgb(this.hue, this.sat, this.lightness);
      color = colorObject(rgb, this.opacity, this.hue, this.sat);
      this.attachValues(color);
  },
  attachValues: function (color) {
      this.red = color.red;
      this.green = color.green;
      this.blue = color.blue;
      this.hue = color.hue;
      this.sat = color.sat;
      this.lightness = color.lightness;
      this.whiteness = color.whiteness;
      this.blackness = color.blackness;
      this.cyan = color.cyan;
      this.magenta = color.magenta;
      this.yellow = color.yellow;
      this.black = color.black;
      this.ncol = color.ncol;
      this.opacity = color.opacity;
      this.valid = color.valid;
  }
};

function toColorObject(c) {
  var x, y, typ, arr = [], arrlength, i, opacity, match, a, hue, sat, rgb, colornames = [], colorhexs = [];
  c = w3trim(c.toLowerCase());
  x = c.substr(0, 1).toUpperCase();
  y = c.substr(1);
  a = 1;
  if ((x == "R" || x == "Y" || x == "G" || x == "C" || x == "B" || x == "M" || x == "W") && !isNaN(y)) {
      if (c.length == 6 && c.indexOf(",") == -1) {
      } else {
          c = "ncol(" + c + ")";
      }
  }
  if (c.length != 3 && c.length != 6 && !isNaN(c)) { c = "ncol(" + c + ")"; }
  if (c.indexOf(",") > 0 && c.indexOf("(") == -1) { c = "ncol(" + c + ")"; }
  if (c.substr(0, 3) == "rgb" || c.substr(0, 3) == "hsl" || c.substr(0, 3) == "hwb" || c.substr(0, 4) == "ncol" || c.substr(0, 4) == "cmyk") {
      if (c.substr(0, 4) == "ncol") {
          if (c.split(",").length == 4 && c.indexOf("ncola") == -1) {
              c = c.replace("ncol", "ncola");
          }
          typ = "ncol";
          c = c.substr(4);
      } else if (c.substr(0, 4) == "cmyk") {
          typ = "cmyk";
          c = c.substr(4);
      } else {
          typ = c.substr(0, 3);
          c = c.substr(3);
      }
      arrlength = 3;
      opacity = false;
      if (c.substr(0, 1).toLowerCase() == "a") {
          arrlength = 4;
          opacity = true;
          c = c.substr(1);
      } else if (typ == "cmyk") {
          arrlength = 4;
          if (c.split(",").length == 5) {
              arrlength = 5;
              opacity = true;
          }
      }
      c = c.replace("(", "");
      c = c.replace(")", "");
      arr = c.split(",");
      if (typ == "rgb") {
          if (arr.length != arrlength) {
              return emptyObject();
          }
          for (i = 0; i < arrlength; i++) {
              if (arr[i] == "" || arr[i] == " ") { arr[i] = "0"; }
              if (arr[i].indexOf("%") > -1) {
                  arr[i] = arr[i].replace("%", "");
                  arr[i] = Number(arr[i] / 100);
                  if (i < 3) { arr[i] = Math.round(arr[i] * 255); }
              }
              if (isNaN(arr[i])) { return emptyObject(); }
              if (parseInt(arr[i]) > 255) { arr[i] = 255; }
              if (i < 3) { arr[i] = parseInt(arr[i]); }
              if (i == 3 && Number(arr[i]) > 1) { arr[i] = 1; }
          }
          rgb = { r: arr[0], g: arr[1], b: arr[2] };
          if (opacity == true) { a = Number(arr[3]); }
      }
      if (typ == "hsl" || typ == "hwb" || typ == "ncol") {
          while (arr.length < arrlength) { arr.push("0"); }
          if (typ == "hsl" || typ == "hwb") {
              if (parseInt(arr[0]) >= 360) { arr[0] = 0; }
          }
          for (i = 1; i < arrlength; i++) {
              if (arr[i].indexOf("%") > -1) {
                  arr[i] = arr[i].replace("%", "");
                  arr[i] = Number(arr[i]);
                  if (isNaN(arr[i])) { return emptyObject(); }
                  arr[i] = arr[i] / 100;
              } else {
                  arr[i] = Number(arr[i]);
              }
              if (Number(arr[i]) > 1) { arr[i] = 1; }
              if (Number(arr[i]) < 0) { arr[i] = 0; }
          }
          if (typ == "hsl") { rgb = hslToRgb(arr[0], arr[1], arr[2]); hue = Number(arr[0]); sat = Number(arr[1]); }
          if (typ == "hwb") { rgb = hwbToRgb(arr[0], arr[1], arr[2]); }
          if (typ == "ncol") { rgb = ncolToRgb(arr[0], arr[1], arr[2]); }
          if (opacity == true) { a = Number(arr[3]); }
      }
      if (typ == "cmyk") {
          while (arr.length < arrlength) { arr.push("0"); }
          for (i = 0; i < arrlength; i++) {
              if (arr[i].indexOf("%") > -1) {
                  arr[i] = arr[i].replace("%", "");
                  arr[i] = Number(arr[i]);
                  if (isNaN(arr[i])) { return emptyObject(); }
                  arr[i] = arr[i] / 100;
              } else {
                  arr[i] = Number(arr[i]);
              }
              if (Number(arr[i]) > 1) { arr[i] = 1; }
              if (Number(arr[i]) < 0) { arr[i] = 0; }
          }
          rgb = cmykToRgb(arr[0], arr[1], arr[2], arr[3]);
          if (opacity == true) { a = Number(arr[4]); }
      }
  } else if (c.substr(0, 3) == "ncs") {
      rgb = ncsToRgb(c);
  } else {
      match = false;
      colornames = getColorArr('names');
      for (i = 0; i < colornames.length; i++) {
          if (c.toLowerCase() == colornames[i].toLowerCase()) {
              colorhexs = getColorArr('hexs');
              match = true;
              rgb = {
                  r: parseInt(colorhexs[i].substr(0, 2), 16),
                  g: parseInt(colorhexs[i].substr(2, 2), 16),
                  b: parseInt(colorhexs[i].substr(4, 2), 16)
              };
              break;
          }
      }
      if (match == false) {
          c = c.replace("#", "");
          if (c.length == 3) { c = c.substr(0, 1) + c.substr(0, 1) + c.substr(1, 1) + c.substr(1, 1) + c.substr(2, 1) + c.substr(2, 1); }
          for (i = 0; i < c.length; i++) {
              if (!isHex(c.substr(i, 1))) { return emptyObject(); }
          }
          arr[0] = parseInt(c.substr(0, 2), 16);
          arr[1] = parseInt(c.substr(2, 2), 16);
          arr[2] = parseInt(c.substr(4, 2), 16);
          for (i = 0; i < 3; i++) {
              if (isNaN(arr[i])) { return emptyObject(); }
          }
          rgb = {
              r: arr[0],
              g: arr[1],
              b: arr[2]
          };
      }
  }
  return colorObject(rgb, a, hue, sat);
}

function colorObject(rgb, a, h, s) {
  var hsl, hwb, cmyk, ncol, color, hue, sat;
  if (!rgb) { return emptyObject(); }
  if (a === null) { a = 1; }
  hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hwb = rgbToHwb(rgb.r, rgb.g, rgb.b);
  cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  hue = (h || hsl.h);
  sat = (s || hsl.s);
  ncol = hueToNcol(hue);
  color = {
      red: rgb.r,
      green: rgb.g,
      blue: rgb.b,
      hue: hue,
      sat: sat,
      lightness: hsl.l,
      whiteness: hwb.w,
      blackness: hwb.b,
      cyan: cmyk.c,
      magenta: cmyk.m,
      yellow: cmyk.y,
      black: cmyk.k,
      ncol: ncol,
      opacity: a,
      valid: true
  };
  color = roundDecimals(color);
  return color;
}

function emptyObject() {
  return {
      red: 0,
      green: 0,
      blue: 0,
      hue: 0,
      sat: 0,
      lightness: 0,
      whiteness: 0,
      blackness: 0,
      cyan: 0,
      magenta: 0,
      yellow: 0,
      black: 0,
      ncol: "R",
      opacity: 1,
      valid: false
  };
}

function getColorArr(x) {
  if (x == "names") { return ['AliceBlue', 'AntiqueWhite', 'Aqua', 'Aquamarine', 'Azure', 'Beige', 'Bisque', 'Black', 'BlanchedAlmond', 'Blue', 'BlueViolet', 'Brown', 'BurlyWood', 'CadetBlue', 'Chartreuse', 'Chocolate', 'Coral', 'CornflowerBlue', 'Cornsilk', 'Crimson', 'Cyan', 'DarkBlue', 'DarkCyan', 'DarkGoldenRod', 'DarkGray', 'DarkGrey', 'DarkGreen', 'DarkKhaki', 'DarkMagenta', 'DarkOliveGreen', 'DarkOrange', 'DarkOrchid', 'DarkRed', 'DarkSalmon', 'DarkSeaGreen', 'DarkSlateBlue', 'DarkSlateGray', 'DarkSlateGrey', 'DarkTurquoise', 'DarkViolet', 'DeepPink', 'DeepSkyBlue', 'DimGray', 'DimGrey', 'DodgerBlue', 'FireBrick', 'FloralWhite', 'ForestGreen', 'Fuchsia', 'Gainsboro', 'GhostWhite', 'Gold', 'GoldenRod', 'Gray', 'Grey', 'Green', 'GreenYellow', 'HoneyDew', 'HotPink', 'IndianRed', 'Indigo', 'Ivory', 'Khaki', 'Lavender', 'LavenderBlush', 'LawnGreen', 'LemonChiffon', 'LightBlue', 'LightCoral', 'LightCyan', 'LightGoldenRodYellow', 'LightGray', 'LightGrey', 'LightGreen', 'LightPink', 'LightSalmon', 'LightSeaGreen', 'LightSkyBlue', 'LightSlateGray', 'LightSlateGrey', 'LightSteelBlue', 'LightYellow', 'Lime', 'LimeGreen', 'Linen', 'Magenta', 'Maroon', 'MediumAquaMarine', 'MediumBlue', 'MediumOrchid', 'MediumPurple', 'MediumSeaGreen', 'MediumSlateBlue', 'MediumSpringGreen', 'MediumTurquoise', 'MediumVioletRed', 'MidnightBlue', 'MintCream', 'MistyRose', 'Moccasin', 'NavajoWhite', 'Navy', 'OldLace', 'Olive', 'OliveDrab', 'Orange', 'OrangeRed', 'Orchid', 'PaleGoldenRod', 'PaleGreen', 'PaleTurquoise', 'PaleVioletRed', 'PapayaWhip', 'PeachPuff', 'Peru', 'Pink', 'Plum', 'PowderBlue', 'Purple', 'RebeccaPurple', 'Red', 'RosyBrown', 'RoyalBlue', 'SaddleBrown', 'Salmon', 'SandyBrown', 'SeaGreen', 'SeaShell', 'Sienna', 'Silver', 'SkyBlue', 'SlateBlue', 'SlateGray', 'SlateGrey', 'Snow', 'SpringGreen', 'SteelBlue', 'Tan', 'Teal', 'Thistle', 'Tomato', 'Turquoise', 'Violet', 'Wheat', 'White', 'WhiteSmoke', 'Yellow', 'YellowGreen']; }
  if (x == "hexs") { return ['f0f8ff', 'faebd7', '00ffff', '7fffd4', 'f0ffff', 'f5f5dc', 'ffe4c4', '000000', 'ffebcd', '0000ff', '8a2be2', 'a52a2a', 'deb887', '5f9ea0', '7fff00', 'd2691e', 'ff7f50', '6495ed', 'fff8dc', 'dc143c', '00ffff', '00008b', '008b8b', 'b8860b', 'a9a9a9', 'a9a9a9', '006400', 'bdb76b', '8b008b', '556b2f', 'ff8c00', '9932cc', '8b0000', 'e9967a', '8fbc8f', '483d8b', '2f4f4f', '2f4f4f', '00ced1', '9400d3', 'ff1493', '00bfff', '696969', '696969', '1e90ff', 'b22222', 'fffaf0', '228b22', 'ff00ff', 'dcdcdc', 'f8f8ff', 'ffd700', 'daa520', '808080', '808080', '008000', 'adff2f', 'f0fff0', 'ff69b4', 'cd5c5c', '4b0082', 'fffff0', 'f0e68c', 'e6e6fa', 'fff0f5', '7cfc00', 'fffacd', 'add8e6', 'f08080', 'e0ffff', 'fafad2', 'd3d3d3', 'd3d3d3', '90ee90', 'ffb6c1', 'ffa07a', '20b2aa', '87cefa', '778899', '778899', 'b0c4de', 'ffffe0', '00ff00', '32cd32', 'faf0e6', 'ff00ff', '800000', '66cdaa', '0000cd', 'ba55d3', '9370db', '3cb371', '7b68ee', '00fa9a', '48d1cc', 'c71585', '191970', 'f5fffa', 'ffe4e1', 'ffe4b5', 'ffdead', '000080', 'fdf5e6', '808000', '6b8e23', 'ffa500', 'ff4500', 'da70d6', 'eee8aa', '98fb98', 'afeeee', 'db7093', 'ffefd5', 'ffdab9', 'cd853f', 'ffc0cb', 'dda0dd', 'b0e0e6', '800080', '663399', 'ff0000', 'bc8f8f', '4169e1', '8b4513', 'fa8072', 'f4a460', '2e8b57', 'fff5ee', 'a0522d', 'c0c0c0', '87ceeb', '6a5acd', '708090', '708090', 'fffafa', '00ff7f', '4682b4', 'd2b48c', '008080', 'd8bfd8', 'ff6347', '40e0d0', 'ee82ee', 'f5deb3', 'ffffff', 'f5f5f5', 'ffff00', '9acd32']; }
}

function roundDecimals(c) {
  c.red = Number(c.red.toFixed(0));
  c.green = Number(c.green.toFixed(0));
  c.blue = Number(c.blue.toFixed(0));
  c.hue = Number(c.hue.toFixed(0));
  c.sat = Number(c.sat.toFixed(2));
  c.lightness = Number(c.lightness.toFixed(2));
  c.whiteness = Number(c.whiteness.toFixed(2));
  c.blackness = Number(c.blackness.toFixed(2));
  c.cyan = Number(c.cyan.toFixed(2));
  c.magenta = Number(c.magenta.toFixed(2));
  c.yellow = Number(c.yellow.toFixed(2));
  c.black = Number(c.black.toFixed(2));
  c.ncol = c.ncol.substr(0, 1) + Math.round(Number(c.ncol.substr(1)));
  c.opacity = Number(c.opacity.toFixed(2));
  return c;
}

function hslToRgb(hue, sat, light) {
  var t1, t2, r, g, b;
  hue = hue / 60;
  if (light <= 0.5) {
      t2 = light * (sat + 1);
  } else {
      t2 = light + sat - (light * sat);
  }
  t1 = light * 2 - t2;
  r = hueToRgb(t1, t2, hue + 2) * 255;
  g = hueToRgb(t1, t2, hue) * 255;
  b = hueToRgb(t1, t2, hue - 2) * 255;
  return { r: r, g: g, b: b };
}

function hueToRgb(t1, t2, hue) {
  if (hue < 0) hue += 6;
  if (hue >= 6) hue -= 6;
  if (hue < 1) return (t2 - t1) * hue + t1;
  else if (hue < 3) return t2;
  else if (hue < 4) return (t2 - t1) * (4 - hue) + t1;
  else return t1;
}

function hwbToRgb(hue, white, black) {
  var i, rgb, rgbArr = [], tot;
  rgb = hslToRgb(hue, 1, 0.50);
  rgbArr[0] = rgb.r / 255;
  rgbArr[1] = rgb.g / 255;
  rgbArr[2] = rgb.b / 255;
  tot = white + black;
  if (tot > 1) {
      white = Number((white / tot).toFixed(2));
      black = Number((black / tot).toFixed(2));
  }
  for (i = 0; i < 3; i++) {
      rgbArr[i] *= (1 - (white) - (black));
      rgbArr[i] += (white);
      rgbArr[i] = Number(rgbArr[i] * 255);
  }
  return { r: rgbArr[0], g: rgbArr[1], b: rgbArr[2] };
}

function cmykToRgb(c, m, y, k) {
  var r, g, b;
  r = 255 - ((Math.min(1, c * (1 - k) + k)) * 255);
  g = 255 - ((Math.min(1, m * (1 - k) + k)) * 255);
  b = 255 - ((Math.min(1, y * (1 - k) + k)) * 255);
  return { r: r, g: g, b: b };
}

function ncolToRgb(ncol, white, black) {
  var letter, percent, h, w, b;
  h = ncol;
  if (isNaN(ncol.substr(0, 1))) {
      letter = ncol.substr(0, 1).toUpperCase();
      percent = ncol.substr(1);
      if (percent == "") { percent = 0; }
      percent = Number(percent);
      if (isNaN(percent)) { return false; }
      if (letter == "R") { h = 0 + (percent * 0.6); }
      if (letter == "Y") { h = 60 + (percent * 0.6); }
      if (letter == "G") { h = 120 + (percent * 0.6); }
      if (letter == "C") { h = 180 + (percent * 0.6); }
      if (letter == "B") { h = 240 + (percent * 0.6); }
      if (letter == "M") { h = 300 + (percent * 0.6); }
      if (letter == "W") {
          h = 0;
          white = 1 - (percent / 100);
          black = (percent / 100);
      }
  }
  return hwbToRgb(h, white, black);
}

function hueToNcol(hue) {
  while (hue >= 360) {
      hue = hue - 360;
  }
  if (hue < 60) { return "R" + (hue / 0.6); }
  if (hue < 120) { return "Y" + ((hue - 60) / 0.6); }
  if (hue < 180) { return "G" + ((hue - 120) / 0.6); }
  if (hue < 240) { return "C" + ((hue - 180) / 0.6); }
  if (hue < 300) { return "B" + ((hue - 240) / 0.6); }
  if (hue < 360) { return "M" + ((hue - 300) / 0.6); }
}

function ncsToRgb(ncs) {
  var black, chroma, bc, percent, black1, chroma1, red1, factor1, blue1, red1, red2, green2, blue2, max, factor2, grey, r, g, b;
  ncs = w3trim(ncs).toUpperCase();
  ncs = ncs.replace("(", "");
  ncs = ncs.replace(")", "");
  ncs = ncs.replace("NCS", "NCS ");
  ncs = ncs.replace(/  /g, " ");
  if (ncs.indexOf("NCS") == -1) { ncs = "NCS " + ncs; }
  ncs = ncs.match(/^(?:NCS|NCS\sS)\s(\d{2})(\d{2})-(N|[A-Z])(\d{2})?([A-Z])?$/);
  if (ncs === null) return false;
  black = parseInt(ncs[1], 10);
  chroma = parseInt(ncs[2], 10);
  bc = ncs[3];
  if (bc != "N" && bc != "Y" && bc != "R" && bc != "B" && bc != "G") { return false; }
  percent = parseInt(ncs[4], 10) || 0;
  if (bc !== 'N') {
      black1 = (1.05 * black - 5.25);
      chroma1 = chroma;
      if (bc === 'Y' && percent <= 60) {
          red1 = 1;
      } else if ((bc === 'Y' && percent > 60) || (bc === 'R' && percent <= 80)) {
          if (bc === 'Y') {
              factor1 = percent - 60;
          } else {
              factor1 = percent + 40;
          }
          red1 = ((Math.sqrt(14884 - Math.pow(factor1, 2))) - 22) / 100;
      } else if ((bc === 'R' && percent > 80) || (bc === 'B')) {
          red1 = 0;
      } else if (bc === 'G') {
          factor1 = (percent - 170);
          red1 = ((Math.sqrt(33800 - Math.pow(factor1, 2))) - 70) / 100;
      }
      if (bc === 'Y' && percent <= 80) {
          blue1 = 0;
      } else if ((bc === 'Y' && percent > 80) || (bc === 'R' && percent <= 60)) {
          if (bc === 'Y') {
              factor1 = (percent - 80) + 20.5;
          } else {
              factor1 = (percent + 20) + 20.5;
          }
          blue1 = (104 - (Math.sqrt(11236 - Math.pow(factor1, 2)))) / 100;
      } else if ((bc === 'R' && percent > 60) || (bc === 'B' && percent <= 80)) {
          if (bc === 'R') {
              factor1 = (percent - 60) - 60;
          } else {
              factor1 = (percent + 40) - 60;
          }
          blue1 = ((Math.sqrt(10000 - Math.pow(factor1, 2))) - 10) / 100;
      } else if ((bc === 'B' && percent > 80) || (bc === 'G' && percent <= 40)) {
          if (bc === 'B') {
              factor1 = (percent - 80) - 131;
          } else {
              factor1 = (percent + 20) - 131;
          }
          blue1 = (122 - (Math.sqrt(19881 - Math.pow(factor1, 2)))) / 100;
      } else if (bc === 'G' && percent > 40) {
          blue1 = 0;
      }
      if (bc === 'Y') {
          green1 = (85 - 17 / 20 * percent) / 100;
      } else if (bc === 'R' && percent <= 60) {
          green1 = 0;
      } else if (bc === 'R' && percent > 60) {
          factor1 = (percent - 60) + 35;
          green1 = (67.5 - (Math.sqrt(5776 - Math.pow(factor1, 2)))) / 100;
      } else if (bc === 'B' && percent <= 60) {
          factor1 = (1 * percent - 68.5);
          green1 = (6.5 + (Math.sqrt(7044.5 - Math.pow(factor1, 2)))) / 100;
      } else if ((bc === 'B' && percent > 60) || (bc === 'G' && percent <= 60)) {
          green1 = 0.9;
      } else if (bc === 'G' && percent > 60) {
          factor1 = (percent - 60);
          green1 = (90 - (1 / 8 * factor1)) / 100;
      }
      factor1 = (red1 + green1 + blue1) / 3;
      red2 = ((factor1 - red1) * (100 - chroma1) / 100) + red1;
      green2 = ((factor1 - green1) * (100 - chroma1) / 100) + green1;
      blue2 = ((factor1 - blue1) * (100 - chroma1) / 100) + blue1;
      if (red2 > green2 && red2 > blue2) {
          max = red2;
      } else if (green2 > red2 && green2 > blue2) {
          max = green2;
      } else if (blue2 > red2 && blue2 > green2) {
          max = blue2;
      } else {
          max = (red2 + green2 + blue2) / 3;
      }
      factor2 = 1 / max;
      r = parseInt((red2 * factor2 * (100 - black1) / 100) * 255, 10);
      g = parseInt((green2 * factor2 * (100 - black1) / 100) * 255, 10);
      b = parseInt((blue2 * factor2 * (100 - black1) / 100) * 255, 10);
      if (r > 255) { r = 255; }
      if (g > 255) { g = 255; }
      if (b > 255) { b = 255; }
      if (r < 0) { r = 0; }
      if (g < 0) { g = 0; }
      if (b < 0) { b = 0; }
  } else {
      grey = parseInt((1 - black / 100) * 255, 10);
      if (grey > 255) { grey = 255; }
      if (grey < 0) { grey = 0; }
      r = grey;
      g = grey;
      b = grey;
  }
  return {
      r: r,
      g: g,
      b: b
  };
}

function rgbToHsl(r, g, b) {
  var min, max, i, l, s, maxcolor, h, rgb = [];
  rgb[0] = r / 255;
  rgb[1] = g / 255;
  rgb[2] = b / 255;
  min = rgb[0];
  max = rgb[0];
  maxcolor = 0;
  for (i = 0; i < rgb.length - 1; i++) {
      if (rgb[i + 1] <= min) { min = rgb[i + 1]; }
      if (rgb[i + 1] >= max) { max = rgb[i + 1]; maxcolor = i + 1; }
  }
  if (maxcolor == 0) {
      h = (rgb[1] - rgb[2]) / (max - min);
  }
  if (maxcolor == 1) {
      h = 2 + (rgb[2] - rgb[0]) / (max - min);
  }
  if (maxcolor == 2) {
      h = 4 + (rgb[0] - rgb[1]) / (max - min);
  }
  if (isNaN(h)) { h = 0; }
  h = h * 60;
  if (h < 0) { h = h + 360; }
  l = (min + max) / 2;
  if (min == max) {
      s = 0;
  } else {
      if (l < 0.5) {
          s = (max - min) / (max + min);
      } else {
          s = (max - min) / (2 - max - min);
      }
  }
  s = s;
  return { h: h, s: s, l: l };
}

function rgbToHwb(r, g, b) {
  var h, w, bl;
  r = r / 255;
  g = g / 255;
  b = b / 255;
  max = Math.max(r, g, b);
  min = Math.min(r, g, b);
  chroma = max - min;
  if (chroma == 0) {
      h = 0;
  } else if (r == max) {
      h = (((g - b) / chroma) % 6) * 360;
  } else if (g == max) {
      h = ((((b - r) / chroma) + 2) % 6) * 360;
  } else {
      h = ((((r - g) / chroma) + 4) % 6) * 360;
  }
  w = min;
  bl = 1 - max;
  return { h: h, w: w, b: bl };
}

function rgbToCmyk(r, g, b) {
  var c, m, y, k;
  r = r / 255;
  g = g / 255;
  b = b / 255;
  max = Math.max(r, g, b);
  k = 1 - max;
  if (k == 1) {
      c = 0;
      m = 0;
      y = 0;
  } else {
      c = (1 - r - k) / (1 - k);
      m = (1 - g - k) / (1 - k);
      y = (1 - b - k) / (1 - k);
  }
  return { c: c, m: m, y: y, k: k };
}

function toHex(n) {
  var hex = n.toString(16);
  while (hex.length < 2) { hex = "0" + hex; }
  return hex;
}

function cl(x) {
  console.log(x);
}

function w3trim(x) {
  return x.replace(/^\s+|\s+$/g, '');
}

function isHex(x) {
  return ('0123456789ABCDEFabcdef'.indexOf(x) > -1);
}

if(typeof window === undefined) window.w3color = w3color;

function w3SetColorsByAttribute() {
var z, i, att;
z = document.getElementsByTagName("*");
for (i = 0; i < z.length; i++) {
  att = z[i].getAttribute("data-w3-color");
  if (att) {
      z[i].style.backgroundColor = w3color(att).toRgbString();
  }
}

}
