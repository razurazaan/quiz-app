
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./MathType.css";
import "./MathTypePlugin.css";
// ── CDN loader ────────────────────────────────────────────────────────────────
const _cache = {};
const loadAsset = (type, url) => {
  if (_cache[url]) return _cache[url];
  _cache[url] = new Promise((ok, fail) => {
    const el = document.createElement(type === "css" ? "link" : "script");
    if (type === "css") { el.rel = "stylesheet"; el.href = url; }
    else { el.src = url; el.async = false; }
    el.onload = ok; el.onerror = fail;
    document.head.appendChild(el);
  });
  return _cache[url];
};
const loadMQ = async () => {
  // await loadAsset("css","https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.css");
  await loadAsset("js","https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js");
  await loadAsset("js","https://cdnjs.cloudflare.com/ajax/libs/mathquill/0.10.1/mathquill.min.js");
  return window.MathQuill.getInterface(2);
};
const readMqLatex = (mq) => {
  try {
    return typeof mq?.latex === "function" ? mq.latex() : "";
  } catch {
    return "";
  }
};
const escapeTextLatex = text => String(text).replace(/[\\{}]/g, "\\$&");
const mqInsertPlainText = (mq, text) => {
  if (!mq) return;
  const textValue = String(text);
  const textLatex = `\\text{${escapeTextLatex(textValue)}}`;
  const preferTextMode = /[^\x20-\x7E]/u.test(textValue);
  const before = readMqLatex(mq);

  if (preferTextMode) {
    try {
      mq.write(textLatex);
    } catch {
      // Fall through to typed text insertion below.
    }

    if (readMqLatex(mq) !== before) {
      mq.focus();
      return;
    }
  }

  try {
    if (typeof mq.typedText === "function") mq.typedText(textValue);
    else mq.write(textValue);
  } catch {
    // Fall through to safer text-mode insertion below.
  }

  if (readMqLatex(mq) === before) {
    try {
      mq.write(textLatex);
    } catch {
      try {
        mq.write(textValue);
      } catch {
        // Keep focus behavior even when MathQuill rejects a rare glyph.
      }
    }
  }

  mq.focus();
};
const mqInsert = (mq, latex, fallbackText = "") => {
  if (!mq) return;
  const before = readMqLatex(mq);
  let wrote = true;
  try {
    mq.write(latex);
  } catch {
    wrote = false;
  }

  if ((!wrote || readMqLatex(mq) === before) && fallbackText) {
    mqInsertPlainText(mq, fallbackText);
    return;
  }

  mq.focus();
};
const splitEquationLines = (latex = "") =>
  String(latex).split(/\s+\\{2,}\s+/).map(line => line.trim()).filter(Boolean);

const MATRIX_SYMBOLS = [
  "a", "b", "c", "d", "e", "f",
  "g", "h", "i", "j", "k", "l",
  "m", "n", "p", "q", "r", "s",
  "t", "u", "v", "w", "x", "y",
  "z"
];

const matrixCellLatex = (index) => MATRIX_SYMBOLS[index] || `x_{${index + 1}}`;

const buildMatrixLatex = (rows = 3, cols = 3, env = "bmatrix", fill = "") => {
  const body = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) =>
      fill === "letters" ? matrixCellLatex(row * cols + col) : ""
    ).join("&")
  ).join("\\\\");

  return `\\begin{${env}}${body}\\end{${env}}`;
};

const parseMatrixLatex = (latex = "") => {
  const match = String(latex).trim().match(/^\\begin\{(bmatrix|pmatrix|vmatrix|matrix|cases|boxmatrix|dboxmatrix)\}([\s\S]*)\\end\{\1\}$/);
  if (!match) return null;

  const rows = match[2].split(/\\\\/).map(row => row.split("&").map(cell => cell.trim()));
  const colCount = Math.max(...rows.map(row => row.length), 1);

  return {
    env: match[1],
    rows: rows.map(row => [...row, ...Array(Math.max(colCount - row.length, 0)).fill("")]),
    rowCount: rows.length,
    colCount,
  };
};

const parseMatrixSequenceLatex = (latex = "") => {
  const parts = String(latex).trim().split(/\s*\\,\s*/).filter(Boolean);
  if (parts.length <= 1) return [];

  const matrices = parts.map(part => parseMatrixLatex(part));
  return matrices.every(Boolean) ? matrices : [];
};

const serializeMatrixLatex = (rows, env = "bmatrix") =>
  `\\begin{${env}}${rows.map(row => row.map(cell => cell.trim()).join("&")).join("\\\\")}\\end{${env}}`;

const resizeMatrixRows = (matrix, nextRows, nextCols) =>
  Array.from({ length: nextRows }, (_, rowIndex) =>
    Array.from({ length: nextCols }, (_, colIndex) => matrix.rows[rowIndex]?.[colIndex] || "")
  );

const renderMatrixElement = (MQ, el, matrix) => {
  el.innerHTML = "";
  el.classList.add("meq-matrix-wrap", `meq-matrix-${matrix.env}`);

  const grid = document.createElement("span");
  grid.className = "meq-matrix-grid";
  grid.style.gridTemplateColumns = `repeat(${matrix.colCount}, auto)`;

  matrix.rows.forEach(row => {
    row.forEach(cellLatex => {
      const cell = document.createElement("span");
      cell.className = "meq-matrix-cell";
      grid.appendChild(cell);

      if (cellLatex) MQ.StaticMath(cell).latex(cellLatex);
      else cell.classList.add("meq-matrix-empty-cell");
    });
  });

  el.appendChild(grid);
};

const renderStaticEquation = (MQ, el, latex) => {
  if (!MQ || !el) return;
  const matrix = parseMatrixLatex(latex);
  const matrixSequence = matrix ? [] : parseMatrixSequenceLatex(latex);
  const lines = splitEquationLines(latex);

  el.style.background = "transparent";
  el.style.backgroundColor = "transparent";
  el.style.borderColor = "transparent";
  el.innerHTML = "";
  el.classList.toggle("meq-multiline", lines.length > 1);
  el.classList.toggle("meq-matrix-wrap", Boolean(matrix));
  el.classList.toggle("meq-matrix-sequence", matrixSequence.length > 1);
  ["bmatrix", "pmatrix", "vmatrix", "matrix", "cases", "boxmatrix", "dboxmatrix"].forEach(env =>
    el.classList.toggle(`meq-matrix-${env}`, matrix?.env === env)
  );

  if (matrix) {
    renderMatrixElement(MQ, el, matrix);
    el.classList.add("mqr");
    return;
  }

  if (matrixSequence.length > 1) {
    matrixSequence.forEach(sequenceMatrix => {
      const matrixEl = document.createElement("span");
      renderMatrixElement(MQ, matrixEl, sequenceMatrix);
      el.appendChild(matrixEl);
    });
    el.classList.add("mqr");
    return;
  }

  if (lines.length <= 1) {
    MQ.StaticMath(el).latex(latex);
  } else {
    lines.forEach(lineLatex => {
      const line = document.createElement("span");
      line.className = "meq-line";
      el.appendChild(line);
      MQ.StaticMath(line).latex(lineLatex);
    });
  }

  el.classList.add("mqr");
};

// ── Symbol data ───────────────────────────────────────────────────────────────
const ARROW_SYMBOL_GROUPS = [
  [
    [
      { d:"←", l:"\\leftarrow", t:"Left arrow" },
      { d:"→", l:"\\rightarrow", t:"Right arrow" },
      { d:"↔", l:"\\leftrightarrow", t:"Left right arrow" },
    ],
    [
      { d:"⇐", l:"\\Leftarrow", t:"Left double arrow" },
      { d:"⇒", l:"\\Rightarrow", t:"Right double arrow" },
      { d:"⇔", l:"\\Leftrightarrow", t:"Left right double arrow" },
    ],
    [
      { d:"↢", l:"↢", t:"Left arrow with tail", plain:true },
      { d:"↣", l:"↣", t:"Right arrow with tail", plain:true },
      { d:"↦", l:"\\mapsto", t:"Maps to" },
    ],
  ],
  [
    [
      { d:"⋮", l:"\\vdots", t:"Vertical dots" },
      { d:"⋱", l:"\\ddots", t:"Down diagonal dots" },
    ],
    [
      { d:"⋯", l:"\\cdots", t:"Centered dots" },
      { d:"⋰", l:"⋰", t:"Up diagonal dots", plain:true },
    ],
    [
      { d:"…", l:"\\ldots", t:"Ellipsis" },
      { d:"⋰", l:"⋰", t:"Up diagonal dots", plain:true },
    ],
  ],
  [
    [
      { d:"−", l:"-", t:"Minus" },
    ],
    [
      { d:"—", l:"—", t:"Long dash", plain:true },
    ],
    [
      { d:"―", l:"―", t:"Horizontal bar", plain:true },
    ],
  ],
  [
    [
      { d:"□→", l:"\\rightarrow", t:"Right arrow with label", template:true },
      { d:"→□", l:"\\rightarrow", t:"Right arrow label template", template:true },
      { d:"□→□", l:"\\rightarrow", t:"Right arrow with above and below labels", template:true },
    ],
    [
      { d:"□←", l:"\\leftarrow", t:"Left arrow with label", template:true },
      { d:"←□", l:"\\leftarrow", t:"Left arrow label template", template:true },
      { d:"□←□", l:"\\leftarrow", t:"Left arrow with above and below labels", template:true },
    ],
    [
      { d:"⇄", l:"\\rightleftarrows", t:"Right left arrows" },
      { d:"⇆", l:"\\leftrightarrows", t:"Left right arrows" },
      { d:"↩", l:"↩", t:"Left hook arrow", plain:true },
    ],
  ],
  [
    [
      { d:"↼", l:"\\leftharpoonup", t:"Left harpoon up" },
      { d:"⇀", l:"\\rightharpoonup", t:"Right harpoon up" },
      { d:"↽", l:"\\leftharpoondown", t:"Left harpoon down" },
      { d:"⇁", l:"\\rightharpoondown", t:"Right harpoon down" },
    ],
    [
      { d:"↿", l:"↿", t:"Up harpoon left", plain:true },
      { d:"↾", l:"↾", t:"Up harpoon right", plain:true },
      { d:"⇃", l:"⇃", t:"Down harpoon left", plain:true },
      { d:"⇂", l:"⇂", t:"Down harpoon right", plain:true },
    ],
    [
      { d:"↞", l:"↞", t:"Two headed left arrow", plain:true },
      { d:"↠", l:"↠", t:"Two headed right arrow", plain:true },
      { d:"↜", l:"↜", t:"Left wave arrow", plain:true },
      { d:"↝", l:"↝", t:"Right wave arrow", plain:true },
    ],
  ],
  [
    [
      { d:"□↑", l:"\\uparrow", t:"Up arrow with label", template:true },
      { d:"↑□", l:"\\uparrow", t:"Up arrow below label", template:true },
    ],
    [
      { d:"□↓", l:"\\downarrow", t:"Down arrow with label", template:true },
      { d:"↓□", l:"\\downarrow", t:"Down arrow below label", template:true },
    ],
    [
      { d:"↑", l:"\\uparrow", t:"Up arrow" },
      { d:"↓", l:"\\downarrow", t:"Down arrow" },
      { d:"↕", l:"\\updownarrow", t:"Up down arrow" },
    ],
  ],
];

const CALCULUS_SYMBOL_GROUPS = [
  [
    [
      { icon:"intLimits", l:"\\int_{}^{}", t:"Integral with upper and lower limits" },
      { icon:"intDifferential", l:"\\int{}d{}", t:"Integral with differential", fallback:"∫ f dx" },
    ],
    [
      { icon:"intLower", l:"\\int_{}", t:"Integral with lower limit" },
      { icon:"intLimitsDifferential", l:"\\int_{}^{}{}d{}", t:"Integral with limits and differential", fallback:"∫ₐᵇ f dx" },
    ],
    [
      { icon:"int", l:"\\int", t:"Integral" },
      { icon:"intDoubleDifferential", l:"\\int{}d{}d{}", t:"Integral with two differentials", fallback:"∫ f dx dy" },
    ],
  ],
  [
    [
      { d:"d", l:"d", t:"Differential d" },
      { icon:"dOverDx", l:"\\frac{d}{d{}}", t:"Derivative operator" },
    ],
    [
      { d:"∂", l:"\\partial", t:"Partial differential" },
      { icon:"partialOverDx", l:"\\frac{\\partial}{\\partial{}}", t:"Partial derivative operator" },
    ],
    [
      { icon:"secondDerivative", l:"\\frac{d^{2}}{d{}^{2}}", t:"Second derivative operator" },
    ],
  ],
  [
    [
      { icon:"limToInfinity", l:"\\lim_{{}\\to\\infty}", t:"Limit to infinity" },
      { icon:"nablaCross", l:"\\nabla\\times{}", t:"Curl" },
      { icon:"nablaBox", l:"\\nabla{}", t:"Gradient" },
    ],
    [
      { icon:"limBox", l:"\\lim_{{}\\to{}}", t:"Limit with condition" },
      { icon:"nablaDot", l:"\\nabla\\cdot{}", t:"Divergence" },
      { icon:"deltaBox", l:"\\Delta{}", t:"Delta operator" },
    ],
    [
      { d:"lim", l:"\\lim", t:"Limit" },
    ],
  ],
  [
    [
      { d:"∫", l:"\\int", t:"Integral" },
      { d:"∬", l:"\\iint", t:"Double integral" },
    ],
    [
      { d:"∮", l:"\\oint", t:"Contour integral" },
      { d:"∭", l:"\\iiint", t:"Triple integral" },
    ],
    [
      { d:"∯", l:"∯", t:"Surface integral", plain:true },
      { d:"∰", l:"∰", t:"Volume integral", plain:true },
    ],
  ],
  [
    [
      { d:"sin", l:"\\sin", t:"Sine" },
      { d:"cos", l:"\\cos", t:"Cosine" },
      { d:"tan", l:"\\tan", t:"Tangent" },
    ],
    [
      { d:"log", l:"\\log", t:"Logarithm" },
      { icon:"logBase", l:"\\log_{}", t:"Logarithm with base" },
      { d:"ln", l:"\\ln", t:"Natural logarithm" },
    ],
    [
      { d:"sec", l:"\\sec", t:"Secant" },
      { d:"csc", l:"\\csc", t:"Cosecant" },
      { d:"cot", l:"\\cot", t:"Cotangent" },
    ],
  ],
];

const LARGE_OPERATOR_SYMBOL_GROUPS = [
  [
    [
      { op:"Σ", mode:"limits", l:"\\sum_{}^{}", t:"Summation with upper and lower limits" },
      { op:"Σ", mode:"upper", l:"\\sum^{}", t:"Summation with upper limit" },
    ],
    [
      { op:"Σ", mode:"plain", l:"\\sum", t:"Summation" },
      { op:"Σ", mode:"lower", l:"\\sum_{}", t:"Summation with lower limit" },
    ],
    [
      { op:"Σ", mode:"sideLimits", l:"\\sum_{}^{}", t:"Inline summation with limits" },
    ],
  ],
  [
    [
      { op:"Π", mode:"limits", l:"\\prod_{}^{}", t:"Product with upper and lower limits" },
      { op:"Π", mode:"upper", l:"\\prod^{}", t:"Product with upper limit" },
    ],
    [
      { op:"Π", mode:"plain", l:"\\prod", t:"Product" },
      { op:"Π", mode:"lower", l:"\\prod_{}", t:"Product with lower limit" },
    ],
    [
      { op:"Π", mode:"sideLimits", l:"\\prod_{}^{}", t:"Inline product with limits" },
    ],
  ],
  [
    [
      { op:"∐", mode:"limits", l:"\\coprod_{}^{}", t:"Coproduct with upper and lower limits" },
      { op:"∐", mode:"sideLimits", l:"\\coprod_{}^{}", t:"Inline coproduct with limits" },
    ],
    [
      { op:"∐", mode:"plain", l:"\\coprod", t:"Coproduct" },
      { op:"⨿", mode:"lower", l:"\\bigsqcup_{}", t:"Disjoint union with lower limit" },
    ],
    [
      { op:"⊔", mode:"plain", l:"\\sqcup", t:"Square union" },
    ],
  ],
  [
    [
      { op:"∩", mode:"large", l:"\\bigcap", t:"Big intersection" },
    ],
    [
      { op:"∪", mode:"large", l:"\\bigcup", t:"Big union" },
    ],
    [
      { op:"⋂", mode:"lower", l:"\\bigcap_{}", t:"Intersection with lower limit" },
      { op:"⋃", mode:"lower", l:"\\bigcup_{}", t:"Union with lower limit" },
    ],
  ],
];

const BRACKET_SYMBOL_GROUPS = [
  [
    [
      { icon:"paren", l:"\\left({}\\right)", t:"Parentheses" },
      { icon:"abs", l:"\\left|{}\\right|", t:"Absolute value bars" },
      { icon:"angle", l:"\\left\\langle{}\\right\\rangle", t:"Angle brackets" },
    ],
    [
      { icon:"bracket", l:"\\left[{}\\right]", t:"Square brackets" },
      { icon:"norm", l:"\\left\\|{}\\right\\|", t:"Double bars / norm" },
      { icon:"brace", l:"\\left\\{{}\\right\\}", t:"Braces" },
    ],
    [
      { icon:"floor", l:"\\lfloor{}\\rfloor", t:"Floor brackets" },
      { icon:"ceil", l:"\\lceil{}\\rceil", t:"Ceiling brackets" },
      { icon:"corner", l:"⌜⌝", t:"Corner brackets", plain:true },
    ],
  ],
  [
    [
      { icon:"overline", l:"\\overline{}", t:"Overline" },
      { icon:"overbrace", l:"\\overbrace{}", t:"Overbrace" },
    ],
    [
      { icon:"underline", l:"\\underline{}", t:"Underline" },
      { icon:"underbrace", l:"\\underbrace{}", t:"Underbrace" },
    ],
    [
      { icon:"boxed", l:buildMatrixLatex(1, 1, "boxmatrix"), t:"Boxed expression" },
      { icon:"sqrtBox", l:"\\sqrt{}", t:"Square root placeholder" },
    ],
  ],
  [
    [
      { icon:"dot", l:"\\dot{}", t:"Dot accent" },
      { icon:"ddot", l:"\\ddot{}", t:"Double dot accent" },
      { icon:"hat", l:"\\hat{}", t:"Hat accent" },
      { icon:"tilde", l:"\\tilde{}", t:"Tilde accent" },
    ],
    [
      { icon:"bar", l:"\\bar{}", t:"Bar accent" },
      { icon:"vec", l:"\\vec{}", t:"Vector accent" },
      { icon:"breve", l:"\\breve{}", t:"Breve accent" },
      { icon:"check", l:"\\check{}", t:"Check accent" },
    ],
    [
      { icon:"prime", l:"{}'", t:"Prime" },
      { icon:"doublePrime", l:"{}''", t:"Double prime" },
      { icon:"widehat", l:"\\widehat{}", t:"Wide hat" },
      { icon:"widetilde", l:"\\widetilde{}", t:"Wide tilde" },
    ],
  ],
  [
    [
      { icon:"leftBar", l:"|", t:"Left vertical bar", plain:true },
      { icon:"rightBar", l:"|", t:"Right vertical bar", plain:true },
      { icon:"rect", l:buildMatrixLatex(1, 1, "boxmatrix"), t:"Rectangle box" },
    ],
    [
      { icon:"leftBracket", l:"[", t:"Left square bracket", plain:true },
      { icon:"rightBracket", l:"]", t:"Right square bracket", plain:true },
      { icon:"circleBox", l:"⊙", t:"Circled operator", plain:true },
    ],
    [
      { icon:"leftBrace", l:"{", t:"Left brace", plain:true },
      { icon:"rightBrace", l:"}", t:"Right brace", plain:true },
      { icon:"squareBox", l:"□", t:"Square symbol", plain:true },
    ],
  ],
  [
    [
      { d:"∅", l:"∅", t:"Empty set", plain:true },
      { d:"⊞", l:"⊞", t:"Box plus", plain:true },
    ],
    [
      { d:"∄", l:"∄", t:"Does not exist", plain:true },
      { d:"⋈", l:"⋈", t:"Bowtie", plain:true },
    ],
    [
      { d:"⊘", l:"⊘", t:"Circled slash", plain:true },
      { d:"⊠", l:"⊠", t:"Box times", plain:true },
    ],
  ],
];

const SCRIPT_LAYOUT_SYMBOL_GROUPS = [
  [
    [
      { icon:"fraction", l:"\\frac{}{}", t:"Fraction" },
      { icon:"smallFraction", l:"\\frac{}{}", t:"Small fraction" },
    ],
    [
      { icon:"slashFraction", l:"\\frac{}{}", t:"Slash fraction" },
      { icon:"bevelFraction", l:"{}/{}", t:"Beveled fraction" },
    ],
    [
      { icon:"stackedFraction", l:"\\frac{\\frac{}{}}{}", t:"Stacked fraction" },
    ],
  ],
  [
    [
      { icon:"sqrt", l:"\\sqrt{}", t:"Square root" },
      { icon:"power", l:"{}^{}", t:"Superscript" },
    ],
    [
      { icon:"nthRoot", l:"\\sqrt[]{}", t:"Nth root" },
      { icon:"subscript", l:"{}_{}", t:"Subscript" },
    ],
    [
      { icon:"rootFraction", l:"\\frac{\\sqrt{}}{}", t:"Root over denominator" },
      { icon:"subsup", l:"{}_{ }^{ }", t:"Subscript and superscript" },
    ],
  ],
  [
    [
      { icon:"leftSup", l:"{}^{}", t:"Left superscript" },
      { icon:"leftSub", l:"{}_{}", t:"Left subscript" },
      { icon:"leftSubsup", l:"{}_{ }^{ }", t:"Left subscript and superscript" },
    ],
    [
      { icon:"rightSup", l:"{}^{}", t:"Right superscript" },
      { icon:"rightSub", l:"{}_{}", t:"Right subscript" },
      { icon:"rightSubsup", l:"{}_{ }^{ }", t:"Right subscript and superscript" },
    ],
    [
      { icon:"prescript", l:"{}_{ }^{ }", t:"Pre-script" },
    ],
  ],
  [
    [
      { icon:"verticalDots", l:"\\vdots", t:"Vertical dots" },
      { icon:"matrixColumn", l:"\\frac{}{}", t:"Two-row column" },
    ],
    [
      { icon:"threeStack", l:"\\frac{\\frac{}{}}{}", t:"Three-row stack" },
      { icon:"caseStack", l:buildMatrixLatex(2, 1, "cases"), t:"Cases stack" },
    ],
    [
      { icon:"dottedStack", l:"{},\\ldots,{}", t:"Dotted stack" },
    ],
  ],
  [
    [
      { icon:"overBox", l:"{}^{}", t:"Box above" },
      { icon:"underBox", l:"{}_{}", t:"Box below" },
    ],
    [
      { icon:"boxedTall", l:buildMatrixLatex(1, 1, "boxmatrix"), t:"Tall box" },
      { icon:"sideBox", l:"{}{}", t:"Side-by-side boxes" },
    ],
    [
      { icon:"doubleBox", l:buildMatrixLatex(1, 1, "dboxmatrix"), t:"Nested box" },
    ],
  ],
  [
    [
      { icon:"smallRow", l:buildMatrixLatex(1, 2, "matrix"), t:"Two small boxes" },
      { icon:"smallPair", l:"{}\\,{}", t:"Spaced pair" },
      { icon:"smallTriple", l:"{}\\,{}\\,{}", t:"Three small boxes" },
    ],
    [
      { icon:"threeColumns", l:buildMatrixLatex(1, 3, "matrix"), t:"Three columns" },
    ],
    [
      { icon:"grid", l:buildMatrixLatex(2, 2, "matrix"), t:"Two by two grid" },
    ],
  ],
];

const ARROW_POPUP_SYMBOL_GROUPS = [
  [
    { d:"↗", l:"↗", t:"North east arrow", plain:true },
    { d:"↘", l:"↘", t:"South east arrow", plain:true },
    { d:"↖", l:"↖", t:"North west arrow", plain:true },
    { d:"↙", l:"↙", t:"South west arrow", plain:true },
  ],
  [
    { d:"·", l:"\\cdot", t:"Dot operator" },
    { d:"⋆", l:"\\star", t:"Star operator" },
    { d:"∘", l:"\\circ", t:"Circle operator" },
    { d:"•", l:"•", t:"Bullet operator", plain:true },
  ],
  [
    { d:"±", l:"\\pm", t:"Plus minus" },
    { d:"∓", l:"\\mp", t:"Minus plus" },
    { d:"×", l:"\\times", t:"Times" },
    { d:"÷", l:"\\div", t:"Division" },
  ],
  [
    { d:"⇋", l:"⇋", t:"Left right harpoons", plain:true },
    { d:"⇌", l:"\\rightleftharpoons", t:"Right left harpoons" },
    { d:"⟶", l:"⟶", t:"Long right arrow", plain:true },
    { d:"⟵", l:"⟵", t:"Long left arrow", plain:true },
  ],
  [
    { d:"⇇", l:"⇇", t:"Paired left arrows", plain:true },
    { d:"⇉", l:"⇉", t:"Paired right arrows", plain:true },
    { d:"⇍", l:"⇍", t:"Not left double arrow", plain:true },
    { d:"⇏", l:"⇏", t:"Not right double arrow", plain:true },
  ],
  [
    { d:"⇑", l:"\\Uparrow", t:"Up double arrow" },
    { d:"⇓", l:"\\Downarrow", t:"Down double arrow" },
    { d:"⇕", l:"\\Updownarrow", t:"Up down double arrow" },
    { d:"↯", l:"↯", t:"Down zigzag arrow", plain:true },
  ],
];

const CALCULUS_POPUP_SYMBOL_GROUPS = [
  [
    { d:"∫₀∞", l:"\\int_{0}^{\\infty}", t:"Integral from zero to infinity", fallback:"∫₀∞" },
    { d:"∫∫", l:"\\iint", t:"Double integral" },
    { d:"∫∫∫", l:"\\iiint", t:"Triple integral" },
  ],
  [
    { d:"d³/dx³", l:"\\frac{d^{3}}{dx^{3}}", t:"Third derivative", fallback:"d³/dx³" },
    { d:"∂³/∂x³", l:"\\frac{\\partial^{3}}{\\partial x^{3}}", t:"Third partial derivative", fallback:"∂³/∂x³" },
    { d:"d/dt", l:"\\frac{d}{dt}", t:"Derivative with respect to t" },
  ],
  [
    { d:"∇²", l:"\\nabla^{2}", t:"Laplacian", fallback:"∇²" },
    { d:"grad", l:"\\nabla f", t:"Gradient" },
    { d:"div", l:"\\nabla\\cdot F", t:"Divergence" },
    { d:"curl", l:"\\nabla\\times F", t:"Curl" },
  ],
  [
    { d:"∮C", l:"\\oint_{C}", t:"Contour integral over C", fallback:"∮C" },
    { d:"∯S", l:"∯_{S}", t:"Surface integral over S", plain:true },
    { d:"∰V", l:"∰_{V}", t:"Volume integral over V", plain:true },
  ],
  [
    { d:"arcsin", l:"\\sin^{-1}", t:"Arc sine" },
    { d:"arccos", l:"\\cos^{-1}", t:"Arc cosine" },
    { d:"arctan", l:"\\tan^{-1}", t:"Arc tangent" },
    { d:"log₁₀", l:"\\log_{10}", t:"Base ten logarithm", fallback:"log₁₀" },
  ],
];

const SCRIPT_LAYOUT_POPUP_SYMBOL_GROUPS = [
  [
    { icon:"nestedFraction", l:"\\frac{}{\\frac{}{}}", t:"Nested denominator fraction" },
    { icon:"sumNumerator", l:"\\frac{+}{}", t:"Sum over denominator" },
    { icon:"sumDenominator", l:"\\frac{}{+}", t:"Numerator over sum" },
  ],
  [
    { icon:"cubeRoot", l:"\\sqrt[3]{}", t:"Cube root", fallback:"∛x" },
    { icon:"fourthRoot", l:"\\sqrt[4]{}", t:"Fourth root", fallback:"⁴√x" },
    { icon:"negativePower", l:"{}^{-1}", t:"Negative power" },
  ],
  [
    { icon:"prescript", l:"{}_{ }^{ }", t:"Pre-script matrix index" },
    { icon:"leftSubsup", l:"{}_{ }^{ }", t:"Left subscript and superscript" },
    { icon:"rightSubsup", l:"{}_{ }^{ }", t:"Right subscript and superscript" },
  ],
  [
    { icon:"verticalDots", l:"\\vdots", t:"Vertical dots" },
    { icon:"dottedStack", l:"{},\\ldots,{}", t:"Dotted sequence" },
    { icon:"caseStack", l:buildMatrixLatex(3, 1, "cases"), t:"Three-line cases" },
  ],
  [
    { icon:"boxedTall", l:buildMatrixLatex(1, 1, "boxmatrix"), t:"Boxed placeholder" },
    { icon:"doubleBox", l:buildMatrixLatex(1, 1, "dboxmatrix"), t:"Double boxed placeholder" },
    { icon:"sideBox", l:"{}\\,{}", t:"Side by side placeholders" },
  ],
  [
    { icon:"grid", l:buildMatrixLatex(2, 2, "matrix"), t:"Two by two grid" },
    { icon:"threeColumns", l:buildMatrixLatex(1, 3, "matrix"), t:"Three-column layout" },
    { icon:"smallTriple", l:"{}\\,{}\\,{}", t:"Three small boxes" },
  ],
];

const BRACKET_POPUP_SYMBOL_GROUPS = [
  [
    { icon:"angle", l:"\\left\\langle{}\\right\\rangle", t:"Angle bracket pair", fallback:"⟨□⟩" },
    { icon:"norm", l:"\\left\\|{}\\right\\|", t:"Norm pair", fallback:"‖□‖" },
    { icon:"corner", l:"⌜⌝", t:"Corner bracket pair", plain:true },
  ],
  [
    { icon:"overline", l:"\\overline{}", t:"Line segment" },
    { icon:"underline", l:"\\underline{}", t:"Underlined segment" },
    { icon:"sqrtBox", l:"\\sqrt{}", t:"Root with expression" },
  ],
  [
    { icon:"widehat", l:"\\hat{}", t:"Hat accent" },
    { icon:"widetilde", l:"\\tilde{}", t:"Tilde accent" },
    { icon:"vec", l:"\\vec{}", t:"Vector accent" },
  ],
  [
    { icon:"leftBar", l:"\\left|", t:"Left absolute value bar", fallback:"|" },
    { icon:"rightBar", l:"\\right|", t:"Right absolute value bar", fallback:"|" },
    { icon:"rect", l:buildMatrixLatex(1, 1, "boxmatrix"), t:"Rectangle placeholder" },
  ],
  [
    { d:"⊡", l:"⊡", t:"Squared dot", plain:true },
    { d:"⊛", l:"⊛", t:"Circled asterisk", plain:true },
    { d:"⊚", l:"⊚", t:"Circled ring", plain:true },
    { d:"⊟", l:"⊟", t:"Box minus", plain:true },
  ],
];

const LARGE_OPERATOR_POPUP_SYMBOL_GROUPS = [
  [
    { op:"⨊", mode:"plain", l:"⨊", t:"Modulo two sum", plain:true },
    { op:"∑", mode:"sideLimits", l:"\\sum_{}^{\\infty}", t:"Infinite series", fallback:"∑∞" },
    { op:"⨋", mode:"plain", l:"⨋", t:"Summation with integral", plain:true },
  ],
  [
    { op:"⋀", mode:"large", l:"\\bigwedge", t:"Big logical and" },
    { op:"⋁", mode:"large", l:"\\bigvee", t:"Big logical or" },
    { op:"⨀", mode:"large", l:"\\bigodot", t:"Big odot" },
  ],
  [
    { op:"⨁", mode:"large", l:"\\bigoplus", t:"Big direct sum" },
    { op:"⨂", mode:"large", l:"\\bigotimes", t:"Big tensor product" },
    { op:"⨄", mode:"large", l:"\\biguplus", t:"Big union plus" },
  ],
  [
    { op:"⋃", mode:"sideLimits", l:"\\bigcup_{}^{}", t:"Union with limits" },
    { op:"⋂", mode:"sideLimits", l:"\\bigcap_{}^{}", t:"Intersection with limits" },
    { op:"⨆", mode:"large", l:"\\bigsqcup", t:"Big square union" },
  ],
];

const GENERIC_POPUP_SYMBOLS = {
  "Greek Letters": [
    { d:"ϑ", l:"\\vartheta", t:"Variant theta", fallback:"ϑ" },
    { d:"ϕ", l:"\\varphi", t:"Variant phi", fallback:"ϕ" },
    { d:"ϖ", l:"\\varpi", t:"Variant pi", fallback:"ϖ" },
    { d:"ϱ", l:"\\varrho", t:"Variant rho", fallback:"ϱ" },
    { d:"ς", l:"\\varsigma", t:"Final sigma", fallback:"ς" },
    { d:"ℏ", l:"\\hbar", t:"Reduced Planck constant", fallback:"ℏ" },
    { d:"ℓ", l:"\\ell", t:"Script ell", fallback:"ℓ" },
    { d:"ℵ", l:"\\aleph", t:"Aleph", fallback:"ℵ" },
    { d:"℧", l:"℧", t:"Mho", plain:true },
  ],
  "Sets & Logic": [
    { d:"⊻", l:"⊻", t:"Exclusive or", plain:true },
    { d:"⊼", l:"⊼", t:"NAND", plain:true },
    { d:"⊽", l:"⊽", t:"NOR", plain:true },
    { d:"⋂", l:"\\bigcap", t:"Big intersection" },
    { d:"⋃", l:"\\bigcup", t:"Big union" },
    { d:"⊗", l:"\\otimes", t:"Tensor product" },
    { d:"⊙", l:"\\odot", t:"Circle dot" },
    { d:"⊝", l:"⊝", t:"Circled dash", plain:true },
    { d:"↯", l:"↯", t:"Contradiction arrow", plain:true },
  ],
  "Trigonometry": [
    { d:"asin", l:"\\sin^{-1}x", t:"Inverse sine" },
    { d:"acos", l:"\\cos^{-1}x", t:"Inverse cosine" },
    { d:"atan", l:"\\tan^{-1}x", t:"Inverse tangent" },
    { d:"sech", l:"\\operatorname{sech}x", t:"Hyperbolic secant", fallback:"sech" },
    { d:"csch", l:"\\operatorname{csch}x", t:"Hyperbolic cosecant", fallback:"csch" },
    { d:"coth", l:"\\coth x", t:"Hyperbolic cotangent" },
    { d:"sin 2x", l:"\\sin 2x", t:"Sine double angle" },
    { d:"cos 2x", l:"\\cos 2x", t:"Cosine double angle" },
    { d:"tan 2x", l:"\\tan 2x", t:"Tangent double angle" },
  ],
  "Matrices & Vectors": [
    { d:"4×4", l:buildMatrixLatex(4, 4, "bmatrix"), t:"4 by 4 matrix" },
    { d:"diag", l:"\\begin{bmatrix}&0\\\\0&\\end{bmatrix}", t:"Diagonal matrix" },
    { d:"det", l:"\\det{}", t:"Determinant" },
    { d:"rank", l:"\\operatorname{rank}{}", t:"Rank", fallback:"rank A" },
    { d:"A⁻¹", l:"{}^{-1}", t:"Inverse matrix" },
    { d:"A*", l:"{}^{*}", t:"Conjugate transpose" },
    { d:"span", l:"\\operatorname{span}\\{{},{}\\}", t:"Span", fallback:"span" },
    { d:"proj", l:"\\operatorname{proj}_{}{}", t:"Projection", fallback:"proj" },
    { d:"⟂", l:"\\perp", t:"Perpendicular" },
  ],
};

const MATRIX_POPUP_TEMPLATES = [
  { icon:"columnPlus", l:buildMatrixLatex(3, 1, "bmatrix") + "+" + buildMatrixLatex(3, 1, "bmatrix"), t:"Column vector addition", fallback:"column vector plus" },
  { icon:"columnMinus", l:buildMatrixLatex(3, 1, "bmatrix") + "-" + buildMatrixLatex(3, 1, "bmatrix"), t:"Column vector subtraction", fallback:"column vector minus" },
  { icon:"scalarColumn", l:"{}" + buildMatrixLatex(3, 1, "bmatrix"), t:"Scalar times column vector", fallback:"x column vector" },
  { icon:"bracketPair", l:buildMatrixLatex(2, 2, "bmatrix"), t:"Bracketed matrix pair" },
  { icon:"blockPair", l:buildMatrixLatex(2, 2, "matrix"), t:"Block matrix layout" },
  { icon:"indexedColumn", l:"{}_{}" + buildMatrixLatex(3, 1, "bmatrix"), t:"Indexed column vector", fallback:"indexed column vector" },
  { l:buildMatrixLatex(3, 1, "bmatrix"), t:"Bracket column vector" },
  { l:buildMatrixLatex(3, 1, "matrix"), t:"Column layout" },
  { l:buildMatrixLatex(3, 2, "bmatrix"), t:"Three by two bracket matrix" },
  { l:buildMatrixLatex(2, 2, "pmatrix"), t:"Two by two parenthesis matrix" },
  { l:buildMatrixLatex(1, 3, "matrix"), t:"Row vector" },
  { l:"\\begin{bmatrix}&0\\\\0&\\end{bmatrix}", t:"Diagonal matrix" },
  { l:buildMatrixLatex(4, 1, "bmatrix"), t:"Four row column vector" },
  { l:buildMatrixLatex(2, 3, "matrix"), t:"Two by three matrix" },
  { d:"⋱", l:"\\ddots", t:"Diagonal dots" },
];

const MATRIX_SELECTOR_ENVS = [
  { env: "bmatrix", title: "Square brackets" },
  { env: "pmatrix", title: "Parentheses" },
  { env: "vmatrix", title: "Determinant bars" },
  { env: "matrix", title: "No brackets" },
];

const MATH_GROUP_ITEMS = [
  { icon:"√", label:"Roots & Fractions", items:[
    {d:"a/b",l:"\\frac{}{}",t:"Fraction"},{d:"√x",l:"\\sqrt{}",t:"Square root"},
    {d:"x²",l:"{}^{2}",t:"Square"},{d:"xⁿ",l:"{}^{}",t:"Power n"},
    {d:"∛x",l:"\\sqrt[3]{}",t:"Cube root"},{d:"1/x",l:"\\frac{1}{}",t:"Reciprocal"},
    {d:"|x|",l:"\\left|{}\\right|",t:"Absolute value"},{d:"⌊x⌋",l:"\\lfloor{}\\rfloor",t:"Floor"},
    {d:"⌈x⌉",l:"\\lceil{}\\rceil",t:"Ceiling"},{d:"a/b/c",l:"\\frac{\\frac{}{}}{}",t:"Nested fraction"},
    {d:"ⁿ√x",l:"\\sqrt[]{}",t:"Nth root"},{d:"√a/b",l:"\\frac{\\sqrt{}}{}",t:"Root over denominator"},
    {d:"a/(b+c)",l:"\\frac{}{+}",t:"Fraction with sum denominator"},{d:"(a+b)/c",l:"\\frac{+}{}",t:"Sum over c"},
    {d:"x⁻¹",l:"{}^{-1}",t:"Negative power"},{d:"xₙ",l:"{}_{}",t:"Subscript n"},
    {d:"xₙᵐ",l:"{}_{ }^{ }",t:"Subscript and superscript"},{d:"ⁿCᵣ",l:"{}^{}C_{}",t:"Combination"},
  ]},
  { icon:"αΩ", label:"Greek Letters", items:[
    {d:"α",l:"\\alpha",t:"alpha"},{d:"β",l:"\\beta",t:"beta"},{d:"γ",l:"\\gamma",t:"gamma"},
    {d:"δ",l:"\\delta",t:"delta"},{d:"ε",l:"\\epsilon",t:"epsilon"},{d:"ζ",l:"\\zeta",t:"zeta"},
    {d:"η",l:"\\eta",t:"eta"},{d:"θ",l:"\\theta",t:"theta"},{d:"ι",l:"\\iota",t:"iota"},
    {d:"κ",l:"\\kappa",t:"kappa"},{d:"λ",l:"\\lambda",t:"lambda"},{d:"μ",l:"\\mu",t:"mu"},
    {d:"ν",l:"\\nu",t:"nu"},{d:"ξ",l:"\\xi",t:"xi"},{d:"ο",l:"o",t:"omicron"},
    {d:"π",l:"\\pi",t:"pi"},{d:"ρ",l:"\\rho",t:"rho"},{d:"σ",l:"\\sigma",t:"sigma"},
    {d:"τ",l:"\\tau",t:"tau"},{d:"υ",l:"\\upsilon",t:"upsilon"},{d:"φ",l:"\\phi",t:"phi"},
    {d:"χ",l:"\\chi",t:"chi"},{d:"ψ",l:"\\psi",t:"psi"},{d:"ω",l:"\\omega",t:"omega"},
    {d:"Γ",l:"\\Gamma",t:"Gamma"},{d:"Δ",l:"\\Delta",t:"Delta"},{d:"Θ",l:"\\Theta",t:"Theta"},
    {d:"Λ",l:"\\Lambda",t:"Lambda"},{d:"Ξ",l:"\\Xi",t:"Xi"},{d:"Π",l:"\\Pi",t:"Pi"},
    {d:"Σ",l:"\\Sigma",t:"Sigma"},{d:"Υ",l:"\\Upsilon",t:"Upsilon"},{d:"Φ",l:"\\Phi",t:"Phi"},
    {d:"Ψ",l:"\\Psi",t:"Psi"},{d:"Ω",l:"\\Omega",t:"Omega"},
  ]},
  { icon:"→", label:"Arrow Symbols", items:[] },
  { icon:"□²", label:"Scripts & Layouts", items:[] },
  { icon:"(□)", label:"Brackets & Accents", items:[] },
  { icon:"Σ∪", label:"Large Operators", items:[] },
  { icon:"∫", label:"Calculus", items:[
    {d:"∫",l:"\\int_{a}^{b}",t:"Definite integral"},{d:"∂f/∂x",l:"\\frac{\\partial f}{\\partial x}",t:"Partial derivative"},
    {d:"dy/dx",l:"\\frac{dy}{dx}",t:"Derivative"},{d:"lim",l:"\\lim_{x\\to 0}",t:"Limit"},
    {d:"∑",l:"\\sum_{i=0}^{n}",t:"Sum"},{d:"∇",l:"\\nabla",t:"Nabla"},
    {d:"∞",l:"\\infty",t:"Infinity"},{d:"∬",l:"\\iint",t:"Double integral"},
    {d:"∮",l:"\\oint",t:"Contour integral"},{d:"d²y/dx²",l:"\\frac{d^{2}y}{dx^{2}}",t:"2nd derivative"},
    {d:"∫f dx",l:"\\int f dx",t:"Indefinite integral"},{d:"∭",l:"\\iiint",t:"Triple integral"},
    {d:"∂²f/∂x²",l:"\\frac{\\partial^{2} f}{\\partial x^{2}}",t:"Second partial derivative"},
    {d:"f′",l:"f'",t:"First derivative prime"},{d:"f″",l:"f''",t:"Second derivative prime"},
    {d:"lim∞",l:"\\lim_{x\\to\\infty}",t:"Limit to infinity"},{d:"∏",l:"\\prod_{i=1}^{n}",t:"Product"},
    {d:"∇·F",l:"\\nabla\\cdot F",t:"Divergence"},{d:"∇×F",l:"\\nabla\\times F",t:"Curl"},
    {d:"dx",l:"dx",t:"Differential dx"},
  ]},
  { icon:"∈", label:"Sets & Logic", items:[
    {d:"∈",l:"\\in",t:"Element of"},{d:"∉",l:"\\notin",t:"Not element"},
    {d:"⊂",l:"\\subset",t:"Subset"},{d:"∪",l:"\\cup",t:"Union"},
    {d:"∩",l:"\\cap",t:"Intersection"},{d:"∅",l:"\\emptyset",t:"Empty set"},
    {d:"∀",l:"\\forall",t:"For all"},{d:"∃",l:"\\exists",t:"Exists"},
    {d:"¬",l:"\\neg",t:"Negation"},{d:"∧",l:"\\wedge",t:"And"},
    {d:"⊆",l:"\\subseteq",t:"Subset or equal"},{d:"⊃",l:"\\supset",t:"Superset"},
    {d:"⊇",l:"\\supseteq",t:"Superset or equal"},{d:"∖",l:"\\setminus",t:"Set difference"},
    {d:"∨",l:"\\vee",t:"Or"},{d:"⇒",l:"\\Rightarrow",t:"Implies"},
    {d:"⇔",l:"\\Leftrightarrow",t:"If and only if"},{d:"⊕",l:"\\oplus",t:"Exclusive or"},
    {d:"∴",l:"\\therefore",t:"Therefore"},{d:"∵",l:"\\because",t:"Because"},
    {d:"∋",l:"\\ni",t:"Contains as member"},{d:"∌",l:"∌",t:"Does not contain",fallback:"∌"},
    {d:"⊄",l:"\\nsubset",t:"Not subset",fallback:"⊄"},{d:"⊈",l:"\\nsubseteq",t:"Not subset or equal",fallback:"⊈"},
    {d:"⊅",l:"\\nsupset",t:"Not superset",fallback:"⊅"},{d:"⊉",l:"\\nsupseteq",t:"Not superset or equal",fallback:"⊉"},
    {d:"⊊",l:"\\subsetneq",t:"Proper subset",fallback:"⊊"},{d:"⊋",l:"\\supsetneq",t:"Proper superset",fallback:"⊋"},
    {d:"ℕ",l:"\\mathbb{N}",t:"Natural numbers",fallback:"ℕ"},{d:"ℤ",l:"\\mathbb{Z}",t:"Integers",fallback:"ℤ"},
    {d:"ℚ",l:"\\mathbb{Q}",t:"Rational numbers",fallback:"ℚ"},{d:"ℝ",l:"\\mathbb{R}",t:"Real numbers",fallback:"ℝ"},
    {d:"ℂ",l:"\\mathbb{C}",t:"Complex numbers",fallback:"ℂ"},{d:"⊤",l:"\\top",t:"True",fallback:"⊤"},
    {d:"⊥",l:"\\bot",t:"False / contradiction",fallback:"⊥"},{d:"⊢",l:"\\vdash",t:"Proves",fallback:"⊢"},
    {d:"⊨",l:"\\models",t:"Models / entails",fallback:"⊨"},{d:"⊬",l:"⊬",t:"Does not prove",fallback:"⊬"},
    {d:"⊭",l:"⊭",t:"Does not entail",fallback:"⊭"},{d:"↦",l:"\\mapsto",t:"Maps to",fallback:"↦"},
  ]},
  { icon:"sin", label:"Trigonometry", items:[
    {d:"sin",l:"\\sin x",t:"sin"},{d:"cos",l:"\\cos x",t:"cos"},
    {d:"tan",l:"\\tan x",t:"tan"},{d:"sin⁻¹",l:"\\sin^{-1}x",t:"arcsin"},
    {d:"cos⁻¹",l:"\\cos^{-1}x",t:"arccos"},{d:"tan⁻¹",l:"\\tan^{-1}x",t:"arctan"},
    {d:"sin²+cos²",l:"\\sin^{2}x+\\cos^{2}x=1",t:"Pythagorean id"},
    {d:"sec",l:"\\sec x",t:"sec"},{d:"csc",l:"\\csc x",t:"csc"},{d:"cot",l:"\\cot x",t:"cot"},
    {d:"sinh",l:"\\sinh x",t:"sinh"},{d:"cosh",l:"\\cosh x",t:"cosh"},{d:"tanh",l:"\\tanh x",t:"tanh"},
  ]},
  { icon:"▦", label:"Matrices & Vectors", items:[
    {d:"[ ]",l:buildMatrixLatex(3,3,"bmatrix"),t:"Bracket matrix"},
    {d:"( )",l:buildMatrixLatex(3,3,"pmatrix"),t:"Parenthesis matrix"},
    {d:"| |",l:buildMatrixLatex(3,3,"vmatrix"),t:"Determinant matrix"},
    {d:"□",l:buildMatrixLatex(3,3,"matrix"),t:"No-bracket matrix"},
    {d:"→v",l:"\\vec{}",t:"Vector"},{d:"u·v",l:"{}\\cdot{}",t:"Dot product"},
    {d:"u×v",l:"{}\\times{}",t:"Cross product"},{d:"‖v‖",l:"\\left\\|{}\\right\\|",t:"Norm"},
    {d:"2×2",l:buildMatrixLatex(2,2,"bmatrix"),t:"2 by 2 matrix"},
    {d:"2×1",l:buildMatrixLatex(2,1,"bmatrix"),t:"2D column vector"},
    {d:"3×1",l:buildMatrixLatex(3,1,"bmatrix"),t:"3D column vector"},
    {d:"I₂",l:"\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}",t:"2 by 2 identity matrix"},
    {d:"Aᵀ",l:"{}^{T}",t:"Transpose"},
  ]},
];

const MATH_GROUP_ORDER = [
  "Roots & Fractions",
  "Sets & Logic",
  "Arrow Symbols",
  "Greek Letters",
  "Matrices & Vectors",
  "Scripts & Layouts",
  "Brackets & Accents",
  "Large Operators",
  "Calculus",
  "Trigonometry",
];

const MATH_GROUPS = MATH_GROUP_ORDER
  .map(label => MATH_GROUP_ITEMS.find(group => group.label === label))
  .filter(Boolean);

const CHEM_GROUPS = [
  { icon:"H₂O", label:"Common Compounds", items:[
    {d:"H₂O",l:"H_{2}O",t:"Water"},{d:"CO₂",l:"CO_{2}",t:"CO₂"},
    {d:"NaCl",l:"NaCl",t:"NaCl"},{d:"H₂SO₄",l:"H_{2}SO_{4}",t:"H₂SO₄"},
    {d:"HCl",l:"HCl",t:"HCl"},{d:"NaOH",l:"NaOH",t:"NaOH"},
    {d:"NH₃",l:"NH_{3}",t:"NH₃"},{d:"CH₄",l:"CH_{4}",t:"Methane"},
    {d:"C₆H₁₂O₆",l:"C_{6}H_{12}O_{6}",t:"Glucose"},{d:"C₂H₅OH",l:"C_{2}H_{5}OH",t:"Ethanol"},
  ]},
  { icon:"⇌", label:"Reaction Arrows", items:[
    {d:"→",l:"\\rightarrow",t:"Proceeds"},{d:"⇌",l:"\\rightleftharpoons",t:"Equilibrium"},
    {d:"↑",l:"\\uparrow",t:"Gas produced"},{d:"↓",l:"\\downarrow",t:"Precipitate"},
    {d:"→Δ",l:"\\xrightarrow{\\Delta}",t:"Heat"},{d:"→cat",l:"\\xrightarrow{cat}",t:"Catalyst"},
    {d:"→hν",l:"\\xrightarrow{h\\nu}",t:"Light"},
  ]},
  { icon:"ΔH", label:"Thermodynamics", items:[
    {d:"ΔH",l:"\\Delta H",t:"Enthalpy"},{d:"ΔG",l:"\\Delta G",t:"Gibbs"},
    {d:"ΔS",l:"\\Delta S",t:"Entropy"},{d:"Kₑq",l:"K_{eq}",t:"Equilibrium const"},
    {d:"pH",l:"pH=-\\log[H^{+}]",t:"pH"},{d:"pV=nRT",l:"pV=nRT",t:"Ideal gas"},
    {d:"Ea",l:"E_{a}",t:"Activation energy"},
  ]},
  { icon:"H⁺", label:"Ions & Charge", items:[
    {d:"H⁺",l:"H^{+}",t:"Proton"},{d:"OH⁻",l:"OH^{-}",t:"Hydroxide"},
    {d:"Na⁺",l:"Na^{+}",t:"Na⁺"},{d:"Fe²⁺",l:"Fe^{2+}",t:"Fe²⁺"},
    {d:"SO₄²⁻",l:"SO_{4}^{2-}",t:"Sulfate"},{d:"e⁻",l:"e^{-}",t:"Electron"},
    {d:"¹²C",l:"{}^{12}C",t:"Carbon-12"},
  ]},
  { icon:"C₆H₆", label:"Organic", items:[
    {d:"CH₄",l:"CH_{4}",t:"Methane"},{d:"C₂H₄",l:"C_{2}H_{4}",t:"Ethylene"},
    {d:"C₆H₆",l:"C_{6}H_{6}",t:"Benzene"},{d:"-COOH",l:"-COOH",t:"Carboxyl"},
    {d:"-OH",l:"-OH",t:"Hydroxyl"},{d:"-NH₂",l:"-NH_{2}",t:"Amino"},
    {d:"C=O",l:"C=O",t:"Carbonyl"},
  ]},
];

const ROOT_FRACTION_MAIN = [
  { icon:"fraction", l:"\\frac{}{}", t:"Fraction" },
  { icon:"sqrt", l:"\\sqrt{}", t:"Square root" },
  { icon:"sup", l:"{}^{}", t:"Superscript", sideLines:true },
  { icon:"paren", l:"\\left({}\\right)", t:"Parentheses" },
  { icon:"bracket", l:"\\left[{}\\right]", t:"Brackets" },
  { icon:"slashFraction", l:"\\frac{}{}", t:"Fraction slash" },
  { icon:"nthRoot", l:"\\sqrt[]{}", t:"Nth root" },
  { icon:"absolute", l:"\\left|{}\\right|", t:"Absolute value", sideLines:true },
  { icon:"brace", l:"\\left\\{{}\\right\\}", t:"Braces" },
  { icon:"subsup", l:"{}_{ }^{ }", t:"Subscript and superscript" },
];

const ROOT_QUICK_SYMBOLS = [
  {d:"+",l:"+"},{d:"/",l:"/"},{d:"≥",l:"\\geq"},{d:"≤",l:"\\leq"},{d:"∅",l:"\\emptyset"},
  {d:"×",l:"\\times"},{d:"±",l:"\\pm"},{d:"∈",l:"\\in"},{d:"⊂",l:"\\subset"},{d:"∞",l:"\\infty"},
  {d:"-",l:"-"},{d:"÷",l:"\\div"},{d:"∪",l:"\\cup"},{d:"∩",l:"\\cap"},{d:"π",l:"\\pi"},
];

const charRange = (start, end) =>
  Array.from({ length: end - start + 1 }, (_, index) => String.fromCodePoint(start + index));

const unicodeLetterLikeRange = (start, end) =>
  charRange(start, end).filter(char => /[\p{L}\p{M}]/u.test(char));

const SPECIAL_CHARACTER_BASE = Array.from(
  "$+<=>^`|~¢£¤¥¦¨©¬®¯°±´¸×÷˂˃˄˅˒˓˔˕˖˗˘˙˚˛˜˝˞˟˥˦˧˨˩˪˫˭˯˰˱˲˳˴˵˶˷˸˹˺˻˼˽˾˿͵΄΅϶҂֏؆؇؈؋؎؏۞۩۽۾฿᾽᾿῀῁῍῎῏῝῞῟῭΅`´῾⁄⁒₠₡₢₣₤₥₦₧₨₩₪₫€₭₮₯₰₱₲₳₴₵₶₷₸₹₺℅№℗℘℞℠™℥℧℩℮⅀⅁⅂⅃⅄⅊⅋⅍〒꜠꜡꞉꞊﬩﮲﮳﮴﮵﮶﮷﮸﮹﮺﮻﮼﮽﮾﮿﯀﯁﷼𝛁𝛛𝛻𝜕𝜵𝝏𝝯𝞉𝞩𝟃"
);

const SPECIAL_CHARACTER_CHARS = Array.from(new Set([
  ...SPECIAL_CHARACTER_BASE,
  ...charRange(0x2190, 0x21FF),
  ...charRange(0x2200, 0x22FF),
  ...charRange(0x2300, 0x23FF),
  ...charRange(0x24B6, 0x24E9),
  ...charRange(0x2500, 0x25FF),
  ...charRange(0x2600, 0x26FF),
  ...charRange(0x27C0, 0x27FF),
  ...charRange(0x2900, 0x29FF),
  ...charRange(0x2980, 0x29FF),
  ...charRange(0x2A00, 0x2AFF),
  ...charRange(0x2B12, 0x2B4C),
]));

const GREEK_CHARACTER_CHARS = Array.from(new Set([
  ...charRange(0x0391, 0x03A9),
  ...charRange(0x03B1, 0x03C9),
  "ϐ", "ϑ", "ϒ", "ϕ", "ϖ", "ϱ", "ϰ", "ϵ", "϶",
]));

const PUNCTUATION_CHARACTER_CHARS = Array.from(new Set(Array.from(String.raw`!"#%&'()*,-./:;?@[\]_{}¡§«¶·»¿;·՚՛՜՝՞՟։֊־׀׃׆׳״؉؊،؍؛؞؟٪٫٬٭۔๏๚๛‐‑‒–—―‖‗‘’‚‛“”„‟†‡•‥…‰‱′″‴‵‶‷‸‹›※‼‽‾⁀⁃⁇⁎⁏⁐⁑⁗⁞⌈⌉⌊⌋〈〉❲❳⟅⟆⟦⟧⟨⟩⟪⟫⟬⟭⟮⟯⦃⦄⦅⦆⦇⦈⦉⦊⦋⦌⦍⦎⦏⦐⦑⦒⦓⦔⦕⦖⦗⦘⧘⧙⧚⧛⧼⧽⸗〰﴾﴿`)));

const LETTER_CHARACTER_CHARS = Array.from(new Set([
  ...charRange(0x41, 0x5A),
  ...charRange(0x61, 0x7A),
  ...unicodeLetterLikeRange(0x00AA, 0x00FF),
  ...unicodeLetterLikeRange(0x0100, 0x024F),
  ...unicodeLetterLikeRange(0x0250, 0x02AF),
  ...unicodeLetterLikeRange(0x02B0, 0x02FF),
  ...unicodeLetterLikeRange(0x0370, 0x03FF),
  ...unicodeLetterLikeRange(0x0400, 0x052F),
  ...unicodeLetterLikeRange(0x0531, 0x0587),
  ...unicodeLetterLikeRange(0x05D0, 0x05F4),
  ...unicodeLetterLikeRange(0x0620, 0x06FF),
  ...unicodeLetterLikeRange(0x0750, 0x077F),
  ...unicodeLetterLikeRange(0x0E01, 0x0E46),
  ...unicodeLetterLikeRange(0x1D00, 0x1DBF),
  ...unicodeLetterLikeRange(0x1E00, 0x1EFF),
  ...unicodeLetterLikeRange(0x1F00, 0x1FFF),
  ...unicodeLetterLikeRange(0x207F, 0x209C),
  ...unicodeLetterLikeRange(0x2100, 0x214F),
  ...unicodeLetterLikeRange(0x2C60, 0x2C7F),
  ...unicodeLetterLikeRange(0xA720, 0xA7FF),
  ...unicodeLetterLikeRange(0xFB00, 0xFDFF),
  ...unicodeLetterLikeRange(0xFE70, 0xFEFC),
  ...unicodeLetterLikeRange(0x1D400, 0x1D7CB),
  "の",
]));

const MARK_CHARACTER_CHARS = Array.from(new Set([
  ...charRange(0x0300, 0x036F),
  ...charRange(0x0483, 0x0489),
  ...charRange(0x0591, 0x05BD),
  String.fromCodePoint(0x05BF),
  String.fromCodePoint(0x05C1),
  String.fromCodePoint(0x05C2),
  String.fromCodePoint(0x05C4),
  String.fromCodePoint(0x05C5),
  String.fromCodePoint(0x05C7),
  ...charRange(0x0610, 0x061A),
  ...charRange(0x064B, 0x065F),
  String.fromCodePoint(0x0670),
  ...charRange(0x06D6, 0x06DC),
  ...charRange(0x06DF, 0x06E4),
  String.fromCodePoint(0x06E7),
  String.fromCodePoint(0x06E8),
  ...charRange(0x06EA, 0x06ED),
  String.fromCodePoint(0x0E31),
  ...charRange(0x0E34, 0x0E3A),
  ...charRange(0x0E47, 0x0E4E),
  String.fromCodePoint(0x1DC0),
  String.fromCodePoint(0x1DC1),
  String.fromCodePoint(0x1DC3),
  String.fromCodePoint(0x1DCA),
  String.fromCodePoint(0x1DFE),
  String.fromCodePoint(0x1DFF),
  ...charRange(0x20D0, 0x20D2),
  String.fromCodePoint(0x20D6),
  String.fromCodePoint(0x20D7),
  ...charRange(0x20DB, 0x20DF),
  String.fromCodePoint(0x20E1),
  ...charRange(0x20E4, 0x20F0),
  String.fromCodePoint(0xFB1E),
  ...charRange(0xFE20, 0xFE23),
]));

const NUMBER_CHARACTER_CHARS = Array.from(
  "0123456789²³¹¼½¾٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹๐๑๒๓๔๕๖๗๘๙0⁴⁵⁶⁷⁸9₀₁₂₃₄₅₆₇₈₉⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞①②③④⑤⑥⑦⑧⑨⓪➀➁➂➃➄➅➆➇➈➉➊➋➌➍➎➏➐➑➒➓𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝟬𝟭ट८९"
);

const PHONETICAL_CHARACTER_CHARS =
 Array.from(String.raw`pbtdʈɖcɟkɡqɢʔmɱnɳɲŋɴrʀɾɽɸβfvθðszʃʒʂʐçʝxɣχʁħʕhɦɬɮʋɹɻjɰlɭʎʟƥɓƭɗƈʄƙɠʠʛʍwɥʜʡʢɧʘǀǃǂǁɺɕʑⱱʇʗʖʆʓɼˢƫɫgʦʣʧʤʨʥᶿᵊᶑƻʞˣƞƛλžšǰčieɛaɑɔouyøœɶɒʌɤɯɨʉɪʏʊəɵɐæɜɚıɞʚɘɷɩʼ̥̬̊ʰ̤̰̼̪̺̻̹̜̟̠̘̙̈̽˞ʷʲˠˤ̃ⁿˡ̴̝̚˔̞˕̢̩̯͜͡˹,ʻ̇˗˖ʸ̡̣̫ˈˌːˑ̆.|‖‿↗↘̋́̄̀̏ꜛꜜ˥˦˧˨˩̌̂᷄᷅᷈̑ˇˆ̖ˎ̗ˏʭʩʪʫ❍*VFWCLJŒΘ𝆑𝆏123͍͈͉͆͊͋͌\͎↓↑ˬᶹ͇͢ʶ˭˱˲˷ABDEGHIKMNOPQRSTUVWXYZ[]/(){}`);

const SPECIAL_CHARACTER_GROUPS = {
  symbol: { label: "Symbol", chars: SPECIAL_CHARACTER_CHARS },
  greek: { label: "Greek", chars: GREEK_CHARACTER_CHARS },
  punctuation: { label: "Punctuation", chars: PUNCTUATION_CHARACTER_CHARS },
  letter: { label: "Letter", chars: LETTER_CHARACTER_CHARS },
  mark: { label: "Mark", chars: MARK_CHARACTER_CHARS },
  number: { label: "Number", chars: NUMBER_CHARACTER_CHARS },
  phonetical: { label: "Phonetical", chars: PHONETICAL_CHARACTER_CHARS },
};

const characterCode = (char) =>
  `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

const symbolFallback = (item) => item?.fallback || item?.d || item?.op || "";

const charFromCode = (value) => {
  const hex = String(value).trim().replace(/^U\+/i, "").replace(/[^0-9a-f]/gi, "");
  if (!hex) return "";
  const codePoint = Number.parseInt(hex, 16);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) return "";
  return String.fromCodePoint(codePoint);
};

function ModalShell({
  title,
  accent,
  children,
  onClose,
  width = "min(400px, 100vw)",
  maxHeight = "min(640px, 100vh)",
}) {
  const bg = accent === "green"
    ? "linear-gradient(135deg,#2d7a2d,#1a5a1a)"
    : "linear-gradient(135deg,#1a5fb4,#0d3d85)";

  return createPortal(
    <div
      className="math-modal-overlay"
    >
      <div
        className="math-modal-shell"
        style={{ "--modal-width": width, "--modal-max-height": maxHeight }}
      >
        <div
          className="math-modal-titlebar"
          style={{ "--modal-accent-bg": bg }}
        >
          <span
            className="math-modal-title"
          >
            {title}
          </span>

          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="math-modal-close"
          >
            ✕
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}

function FloatingPanel({ anchorRef, open, className, children, align = "right", offset = 6 }) {
  const panelRef = useRef(null);
  const [style, setStyle] = useState({
    position: "fixed",
    top: 0,
    left: 0,
    right: "auto",
    bottom: "auto",
    zIndex: 10020,
    visibility: "hidden",
  });

  useEffect(() => {
    if (!open) return undefined;

    let frame = 0;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const anchorRect = anchor.getBoundingClientRect();
      const panel = panelRef.current;
      const panelWidth = panel?.offsetWidth || 0;
      const panelHeight = panel?.offsetHeight || 0;
      const viewportPadding = 8;
      const preferredLeft = align === "right"
        ? anchorRect.right - panelWidth
        : anchorRect.left;

      const left = panelWidth
        ? Math.max(viewportPadding, Math.min(preferredLeft, window.innerWidth - panelWidth - viewportPadding))
        : preferredLeft;
      const belowTop = anchorRect.bottom + offset;
      const top = panelHeight && belowTop + panelHeight > window.innerHeight - viewportPadding
        ? Math.max(viewportPadding, anchorRect.top - panelHeight - offset)
        : belowTop;

      setStyle({
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        right: "auto",
        bottom: "auto",
        zIndex: 10020,
        visibility: "visible",
      });
    };

    update();
    frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [align, anchorRef, offset, open]);

  if (!open) return null;

  return createPortal(
    <div ref={panelRef} className={className} style={style}>
      {children}
    </div>,
    document.body
  );
}

function useCloseFloatingPanel(open, setOpen, anchorRef, panelSelector) {
  useEffect(() => {
    if (!open) return undefined;

    const closeWhenOutside = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (anchorRef.current?.contains(target) || target.closest(panelSelector)) return;
      setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeWhenOutside, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [anchorRef, open, panelSelector, setOpen]);
}

// ── Small symbol button inside modals ─────────────────────────────────────────
const SB = ({children,onClick,title,active,color="#000",bg="#f8f9fa",activeBg="#dbeafe"}) => {
  return (
    <button type="button" title={title} onClick={onClick}
      className={`modal-small-symbol ${active ? "active" : ""}`}
      style={{ "--symbol-color": color, "--symbol-bg": bg, "--symbol-active-bg": activeBg }}>
      {children}
    </button>
  );
};

const RIBBON_MINI = {
  "Roots & Fractions": "√□",
  "Greek Letters": "α Ω",
  "Arrow Symbols": "→ ↔",
  "Scripts & Layouts": "□²",
  "Brackets & Accents": "(□)",
  "Large Operators": "Σ U",
  "Calculus": "Σ ∫",
  "Sets & Logic": "∈ ∞",
  "Trigonometry": "sin",
  "Matrices & Vectors": "▦▦",
};

const chunkRibbonItems = (items, perGroup = 9, perRow = 3) => {
  const groups = [];

  for (let groupStart = 0; groupStart < items.length; groupStart += perGroup) {
    const groupItems = items.slice(groupStart, groupStart + perGroup);
    const rows = [];

    for (let rowStart = 0; rowStart < groupItems.length; rowStart += perRow) {
      rows.push(groupItems.slice(rowStart, rowStart + perRow));
    }

    groups.push(rows);
  }

  return groups;
};

const nextRibbonGroupItems = (groups, index) => {
  if (groups.length <= 1) return [];
  const nextGroup = groups[(index + 1) % groups.length];
  return nextGroup.flat();
};

const ribbonPopupItems = (groups, index, popupGroups = []) =>
  popupGroups.length ? popupGroups[index % popupGroups.length] : nextRibbonGroupItems(groups, index);

function RibbonPopupCluster({
  group,
  popupItems = [],
  classPrefix,
  buttonClassName,
  renderItem,
  onPick,
  popupTitle = "More symbols",
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  useCloseFloatingPanel(open, setOpen, triggerRef, ".ribbon-popup-panel");
  const buttonClass = (item) =>
    typeof buttonClassName === "function" ? buttonClassName(item) : buttonClassName;

  const pick = (item) => {
    onPick(item);
    setOpen(false);
  };

  return (
    <div className={`${classPrefix}-cluster ribbon-popup-cluster`}>
      {group.map((row, rowIndex) => (
        <div className={`${classPrefix}-row`} key={`${classPrefix}-row-${rowIndex}`}>
          {row.map((item, itemIndex) => (
            <button
              key={`${item.t || item.d || item.op || item.icon}-${item.l}-${rowIndex}-${itemIndex}`}
              type="button"
              title={item.t}
              className={buttonClass(item)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(item)}
            >
              {renderItem(item)}
            </button>
          ))}
        </div>
      ))}

      {popupItems.length > 0 && (
        <>
          <button
            ref={triggerRef}
            type="button"
            title={popupTitle}
            aria-expanded={open}
            className={`ribbon-popup-trigger ${open ? "active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(value => !value)}
          >
            ▾
          </button>

          <FloatingPanel anchorRef={triggerRef} open={open} className="ribbon-popup-panel" offset={4}>
              {popupItems.map((item, index) => (
                <button
                  key={`popup-${item.t || item.d || item.op || item.icon}-${item.l}-${index}`}
                  type="button" 
                  title={item.t}
                  className={`ribbon-popup-item ${buttonClass(item)}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                >
                  {renderItem(item)}
                </button>
              ))}
          </FloatingPanel>
        </>
      )}
    </div>
  );
}

function GenericSymbolPalette({ items, popupItems = [], onInsert, onMatrix }) {
  const groups = chunkRibbonItems(items);
  const popupGroups = chunkRibbonItems(popupItems).map(group => group.flat());
  const handleInsert = (item) => {
    if (parseMatrixLatex(item.l) && onMatrix) onMatrix(item.l);
    else onInsert(item.l, symbolFallback(item));
  };

  return (
    <div className="generic-symbol-board" aria-label="Math symbols">
      {groups.map((group, groupIndex) => (
        <RibbonPopupCluster
          key={`generic-symbol-group-${groupIndex}`}
          group={group}
          popupItems={ribbonPopupItems(groups, groupIndex, popupGroups)}
          classPrefix="generic-symbol"
          buttonClassName="math-ribbon-symbol"
          renderItem={(item) => item.d}
          onPick={handleInsert}
          popupTitle="More symbols in this section"
        />
      ))}
    </div>
  );
}

function MatrixTemplateIcon({ item }) {
  if (item.icon) {
    const column = (
      <span className="matrix-op-column">
        <span className="matrix-template-cell" />
        <span className="matrix-template-cell" />
        <span className="matrix-template-cell" />
      </span>
    );
    const smallBlock = (
      <span className="matrix-op-block">
        <span className="matrix-template-cell" />
        <span className="matrix-template-cell" />
      </span>
    );

    switch (item.icon) {
      case "columnPlus":
      case "columnMinus":
        return (
          <span className="matrix-op-icon">
            {column}
            <span className="matrix-op-symbol">{item.icon === "columnPlus" ? "+" : "−"}</span>
            {column}
          </span>
        );
      case "scalarColumn":
        return (
          <span className="matrix-op-icon">
            <span className="matrix-op-symbol">x</span>
            {column}
          </span>
        );
      case "bracketPair":
        return (
          <span className="matrix-op-icon bracket-pair">
            <span className="matrix-op-bracket">[</span>
            {smallBlock}
            <span className="matrix-op-bracket">]</span>
            {smallBlock}
          </span>
        );
      case "blockPair":
        return (
          <span className="matrix-op-icon block-pair">
            {smallBlock}
            <span className="matrix-op-separator" />
            {smallBlock}
          </span>
        );
      case "indexedColumn":
        return (
          <span className="matrix-op-icon indexed-column">
            <span className="matrix-op-symbol small">n</span>
            {column}
          </span>
        );
      default:
        break;
    }
  }

  const matrix = parseMatrixLatex(item.l);

  if (!matrix) {
    return <span className="matrix-symbol-text">{item.d}</span>;
  }

  const rows = Math.min(matrix.rowCount || 1, 4);
  const cols = Math.min(matrix.colCount || 1, 4);
  const cells = Array.from({ length: rows * cols });

  return (
    <span className={`matrix-template-icon matrix-template-${matrix.env}`}>
      <span className="matrix-template-left" />
      <span
        className="matrix-template-grid"
        style={{ "--matrix-icon-cols": cols }}
      >
        {cells.map((_, index) => (
          <span key={index} className="matrix-template-cell" />
        ))}
      </span>
      <span className="matrix-template-right" />
    </span>
  );
}

function MatrixSymbolPalette({ items, popupItems = MATRIX_POPUP_TEMPLATES, onInsert, onMatrix }) {
  const [open, setOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorEnv, setSelectorEnv] = useState("bmatrix");
  const [selectorSize, setSelectorSize] = useState({ rows: 1, cols: 2 });
  const triggerRef = useRef(null);
  const selectorRef = useRef(null);
  useCloseFloatingPanel(open, setOpen, triggerRef, ".matrix-symbol-popup");
  useCloseFloatingPanel(selectorOpen, setSelectorOpen, selectorRef, ".matrix-size-popup");
  const groups = chunkRibbonItems(items, 12, 4);
  const handleInsert = (item) => {
    if (parseMatrixLatex(item.l) && onMatrix) onMatrix(item.l);
    else onInsert(item.l, symbolFallback(item));
  };
  const pickMatrixSize = (rows, cols) => {
    const latex = buildMatrixLatex(rows, cols, selectorEnv);
    if (onMatrix) onMatrix(latex);
    else onInsert(latex, `${rows} by ${cols} matrix`);
    setSelectorOpen(false);
  };

  return (
    <div className="matrix-symbol-board" aria-label="Matrix symbols">
      {groups.map((group, groupIndex) => (
        <div className="matrix-symbol-cluster" key={`matrix-symbol-group-${groupIndex}`}>
          {group.map((row, rowIndex) => (
            <div className="matrix-symbol-row" key={`matrix-symbol-row-${groupIndex}-${rowIndex}`}>
              {row.map((item, itemIndex) => {
                const isBracketMatrix = item.t === "Bracket matrix";

                return (
                  <span className="matrix-symbol-button-wrap" key={`${item.t || item.d}-${item.l}-${rowIndex}-${itemIndex}`}>
                    <button
                      ref={isBracketMatrix ? selectorRef : null}
                      type="button"
                      title={isBracketMatrix ? "Choose bracket matrix size" : item.t}
                      aria-expanded={isBracketMatrix ? selectorOpen : undefined}
                      className={`matrix-symbol-button ${parseMatrixLatex(item.l) ? "template" : ""} ${isBracketMatrix && selectorOpen ? "active" : ""}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (isBracketMatrix) {
                          setSelectorEnv("bmatrix");
                          setSelectorOpen(value => !value);
                        } else {
                          handleInsert(item);
                        }
                      }}
                    >
                      <MatrixTemplateIcon item={item} />
                    </button>

                    {isBracketMatrix && (
                      <FloatingPanel anchorRef={selectorRef} open={selectorOpen} className="matrix-size-popup" align="left" offset={4}>
                        <div className="matrix-style-selector" aria-label="Matrix style">
                          {MATRIX_SELECTOR_ENVS.map(style => (
                            <button
                              key={style.env}
                              type="button"
                              title={style.title}
                              className={`matrix-style-button ${selectorEnv === style.env ? "active" : ""}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => setSelectorEnv(style.env)}
                            >
                              <MatrixTemplateIcon item={{ l: buildMatrixLatex(2, 2, style.env), t: style.title }} />
                            </button>
                          ))}
                        </div>

                        <div className="matrix-size-selector" aria-label="Matrix size selector">
                          {Array.from({ length: 6 }, (_, selectorRowIndex) =>
                            Array.from({ length: 6 }, (_, selectorColIndex) => {
                              const rows = selectorRowIndex + 1;
                              const cols = selectorColIndex + 1;
                              const active = rows <= selectorSize.rows && cols <= selectorSize.cols;

                              return (
                                <button
                                  key={`${rows}-${cols}`}
                                  type="button"
                                  title={`${rows} row${rows > 1 ? "s" : ""}, ${cols} column${cols > 1 ? "s" : ""}`}
                                  className={`matrix-size-cell ${active ? "active" : ""}`}
                                  onMouseEnter={() => setSelectorSize({ rows, cols })}
                                  onFocus={() => setSelectorSize({ rows, cols })}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => pickMatrixSize(rows, cols)}
                                />
                              );
                            })
                          )}
                        </div>

                        <div className="matrix-size-readout">
                          <span>Rows:</span>
                          <strong>{selectorSize.rows}</strong>
                          <span>Columns:</span>
                          <strong>{selectorSize.cols}</strong>
                        </div>
                      </FloatingPanel>
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      ))}
      {popupItems.length > 0 && (
        <div className="matrix-symbol-cluster matrix-symbol-popup-cluster">
          <button
            ref={triggerRef}
            type="button"
            title="More matrix templates"
            aria-expanded={open}
            className={`matrix-symbol-more-trigger ${open ? "active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen(value => !value)}
          >
            ▾
          </button>

          <FloatingPanel anchorRef={triggerRef} open={open} className="matrix-symbol-popup" align="right" offset={4}>
            {popupItems.map((item, index) => (
              <button
                key={`matrix-popup-${item.t || item.d}-${item.l}-${index}`}
                type="button"
                title={item.t}
                className={`matrix-symbol-popup-item ${parseMatrixLatex(item.l) ? "template" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  handleInsert(item);
                  setOpen(false);
                }}
              >
                <MatrixTemplateIcon item={item} />
              </button>
            ))}
          </FloatingPanel>
        </div>
      )}
    </div>
  );
}

function ArrowSymbolPalette({ onInsert, onPlainInsert }) {
  const groups = ARROW_SYMBOL_GROUPS;
  const handleInsert = (item) => {
    if (item.plain) onPlainInsert(item.l);
    else onInsert(item.l, symbolFallback(item));
  };

  return (
    <div className="arrow-symbol-board" aria-label="Arrow symbols">
      {groups.map((group, groupIndex) => (
        <RibbonPopupCluster
          key={`arrow-group-${groupIndex}`}
          group={group}
          popupItems={ribbonPopupItems(groups, groupIndex, ARROW_POPUP_SYMBOL_GROUPS)}
          classPrefix="arrow-symbol"
          buttonClassName={(item) => `arrow-symbol-button ${item.template ? "template" : ""}`}
          renderItem={(item) => item.d}
          onPick={handleInsert}
          popupTitle="More arrow symbols"
        />
      ))}
    </div>
  );
}

function CalcBox({ small = false }) {
  return <span className={`calculus-template-box ${small ? "small" : ""}`} />;
}

function CalculusIcon({ item }) {
  switch (item.icon) {
    case "intLimits":
      return (
        <span className="calculus-int-template">
          <CalcBox small />
          <span className="calculus-int-symbol">∫</span>
          <CalcBox small />
        </span>
      );
    case "intLower":
      return (
        <span className="calculus-int-template lower-only">
          <span className="calculus-int-symbol">∫</span>
          <CalcBox small />
        </span>
      );
    case "intDifferential":
      return (
        <span className="calculus-int-template differential">
          <span className="calculus-int-symbol">∫</span>
          <span>d</span>
          <CalcBox small />
        </span>
      );
    case "intLimitsDifferential":
      return (
        <span className="calculus-int-template differential">
          <CalcBox small />
          <span className="calculus-int-symbol">∫</span>
          <CalcBox small />
          <span>d</span>
          <CalcBox small />
        </span>
      );
    case "intDoubleDifferential":
      return (
        <span className="calculus-int-template differential">
          <span className="calculus-int-symbol">∫</span>
          <span>d</span>
          <CalcBox small />
          <span>d</span>
          <CalcBox small />
        </span>
      );
    case "int":
      return <span className="calculus-large-op">∫</span>;
    case "dOverDx":
      return (
        <span className="calculus-frac">
          <span>d</span>
          <span className="calculus-frac-line" />
          <span>d<CalcBox small /></span>
        </span>
      );
    case "partialOverDx":
      return (
        <span className="calculus-frac">
          <span>∂</span>
          <span className="calculus-frac-line" />
          <span>∂<CalcBox small /></span>
        </span>
      );
    case "secondDerivative":
      return (
        <span className="calculus-frac">
          <span>d²</span>
          <span className="calculus-frac-line" />
          <span>d<CalcBox small />²</span>
        </span>
      );
    case "limToInfinity":
      return (
        <span className="calculus-lim-template">
          <span>lim</span>
          <span><CalcBox small />→∞</span>
        </span>
      );
    case "limBox":
      return (
        <span className="calculus-lim-template">
          <span>lim</span>
          <CalcBox small />
        </span>
      );
    case "nablaCross":
      return <span className="calculus-inline-template">∇×<CalcBox small /></span>;
    case "nablaDot":
      return <span className="calculus-inline-template">∇·<CalcBox small /></span>;
    case "nablaBox":
      return <span className="calculus-inline-template">∇<CalcBox small /></span>;
    case "deltaBox":
      return <span className="calculus-inline-template">Δ<CalcBox small /></span>;
    case "logBase":
      return <span className="calculus-log-base">log<CalcBox small /></span>;
    default:
      return item.d;
  }
}

function CalculusSymbolPalette({ onInsert, onPlainInsert }) {
  const groups = CALCULUS_SYMBOL_GROUPS;
  const handleInsert = (item) => {
    if (item.plain) onPlainInsert(item.l);
    else onInsert(item.l, symbolFallback(item));
  };

  return (
    <div className="calculus-symbol-board" aria-label="Calculus symbols">
      {groups.map((group, groupIndex) => (
        <RibbonPopupCluster
          key={`calculus-group-${groupIndex}`}
          group={group}
          popupItems={ribbonPopupItems(groups, groupIndex, CALCULUS_POPUP_SYMBOL_GROUPS)}
          classPrefix="calculus-symbol"
          buttonClassName={(item) => `calculus-symbol-button ${item.icon ? "template" : ""}`}
          renderItem={(item) => <CalculusIcon item={item} />}
          onPick={handleInsert}
          popupTitle="More calculus symbols"
        />
      ))}
    </div>
  );
}

function ScriptBox({ small = false, tall = false }) {
  const classes = ["script-layout-box"];
  if (small) classes.push("small");
  if (tall) classes.push("tall");
  return <span className={classes.join(" ")} />;
}

function ScriptLayoutIcon({ item }) {
  switch (item.icon) {
    case "fraction":
      return (
        <span className="script-layout-fraction">
          <ScriptBox />
          <span className="script-layout-line" />
          <ScriptBox />
        </span>
      );
    case "smallFraction":
      return (
        <span className="script-layout-fraction small">
          <ScriptBox small />
          <span className="script-layout-line short" />
          <ScriptBox small />
        </span>
      );
    case "slashFraction":
      return <span className="script-layout-inline"><ScriptBox />/<ScriptBox /></span>;
    case "bevelFraction":
      return <span className="script-layout-inline small"><ScriptBox small />⁄<ScriptBox small /></span>;
    case "stackedFraction":
      return (
        <span className="script-layout-fraction nested">
          <span className="script-layout-fraction small">
            <ScriptBox small />
            <span className="script-layout-line short" />
            <ScriptBox small />
          </span>
          <span className="script-layout-line" />
          <ScriptBox small />
        </span>
      );
    case "sqrt":
      return <span className="script-layout-root">√<span className="script-layout-root-line"><ScriptBox /></span></span>;
    case "nthRoot":
      return <span className="script-layout-root nth"><ScriptBox small />√<span className="script-layout-root-line"><ScriptBox /></span></span>;
    case "rootFraction":
      return (
        <span className="script-layout-fraction root-fraction">
          <span className="script-layout-root">√<span className="script-layout-root-line"><ScriptBox small /></span></span>
          <span className="script-layout-line" />
          <ScriptBox small />
        </span>
      );
    case "power":
      return <span className="script-layout-script"><ScriptBox /><span className="script-layout-script-stack upper"><ScriptBox small /></span></span>;
    case "subscript":
      return <span className="script-layout-script"><ScriptBox /><span className="script-layout-script-stack lower"><ScriptBox small /></span></span>;
    case "subsup":
      return <span className="script-layout-script"><ScriptBox /><span className="script-layout-script-stack"><ScriptBox small /><ScriptBox small /></span></span>;
    case "leftSup":
      return <span className="script-layout-script left"><span className="script-layout-script-stack upper"><ScriptBox small /></span><ScriptBox /></span>;
    case "leftSub":
      return <span className="script-layout-script left"><span className="script-layout-script-stack lower"><ScriptBox small /></span><ScriptBox /></span>;
    case "leftSubsup":
    case "prescript":
      return <span className="script-layout-script left"><span className="script-layout-script-stack"><ScriptBox small /><ScriptBox small /></span><ScriptBox /></span>;
    case "rightSup":
      return <span className="script-layout-script"><ScriptBox /><span className="script-layout-script-stack upper"><ScriptBox small /></span></span>;
    case "rightSub":
      return <span className="script-layout-script"><ScriptBox /><span className="script-layout-script-stack lower"><ScriptBox small /></span></span>;
    case "rightSubsup":
      return <span className="script-layout-script"><ScriptBox /><span className="script-layout-script-stack"><ScriptBox small /><ScriptBox small /></span></span>;
    case "verticalDots":
      return <span className="script-layout-dots">⋮</span>;
    case "matrixColumn":
      return <span className="script-layout-stack"><ScriptBox small /><ScriptBox small /></span>;
    case "threeStack":
      return <span className="script-layout-stack"><ScriptBox small /><ScriptBox small /><ScriptBox small /></span>;
    case "caseStack":
      return <span className="script-layout-case">{"{"}<span className="script-layout-stack"><ScriptBox small /><ScriptBox small /></span></span>;
    case "dottedStack":
      return <span className="script-layout-stack"><ScriptBox small /><span className="script-layout-mini-dots">⋮</span><ScriptBox small /></span>;
    case "overBox":
      return <span className="script-layout-stack"><ScriptBox small /><ScriptBox /></span>;
    case "underBox":
      return <span className="script-layout-stack"><ScriptBox /><ScriptBox small /></span>;
    case "boxedTall":
      return <span className="script-layout-framed"><ScriptBox tall /></span>;
    case "sideBox":
      return <span className="script-layout-inline"><ScriptBox /><ScriptBox /></span>;
    case "doubleBox":
      return <span className="script-layout-framed"><span className="script-layout-framed inner"><ScriptBox small /></span></span>;
    case "smallRow":
      return <span className="script-layout-inline"><ScriptBox small /><ScriptBox small /></span>;
    case "smallPair":
      return <span className="script-layout-inline spaced"><ScriptBox small /><ScriptBox small /></span>;
    case "smallTriple":
      return <span className="script-layout-inline"><ScriptBox small /><ScriptBox small /><ScriptBox small /></span>;
    case "threeColumns":
      return <span className="script-layout-inline"><ScriptBox small /><ScriptBox small /><ScriptBox small /></span>;
    case "grid":
      return <span className="script-layout-grid"><ScriptBox small /><ScriptBox small /><ScriptBox small /><ScriptBox small /></span>;
    case "sumNumerator":
    case "sumDenominator":
    case "cubeRoot":
    case "fourthRoot":
    case "negativePower":
      return <RootFractionIcon type={item.icon} />;
    default:
      return item.d;
  }
}

function ScriptLayoutPalette({ onInsert, onPlainInsert }) {
  const groups = SCRIPT_LAYOUT_SYMBOL_GROUPS;
  const handleInsert = (item) => {
    if (item.plain) onPlainInsert(item.l);
    else onInsert(item.l, symbolFallback(item));
  };

  return (
    <div className="script-layout-board" aria-label="Scripts and layouts">
      {groups.map((group, groupIndex) => (
        <RibbonPopupCluster
          key={`script-layout-group-${groupIndex}`}
          group={group}
          popupItems={ribbonPopupItems(groups, groupIndex, SCRIPT_LAYOUT_POPUP_SYMBOL_GROUPS)}
          classPrefix="script-layout"
          buttonClassName="script-layout-button"
          renderItem={(item) => <ScriptLayoutIcon item={item} />}
          onPick={handleInsert}
          popupTitle="More script and layout symbols"
        />
      ))}
    </div>
  );
}

function BracketBox({ small = false }) {
  return <span className={`bracket-template-box ${small ? "small" : ""}`} />;
}

function BracketIcon({ item }) {
  switch (item.icon) {
    case "paren":
      return <span className="bracket-template fence">( <BracketBox /> )</span>;
    case "abs":
      return <span className="bracket-template fence">|<BracketBox />|</span>;
    case "angle":
      return <span className="bracket-template fence">〈<BracketBox />〉</span>;
    case "bracket":
      return <span className="bracket-template fence">[<BracketBox />]</span>;
    case "norm":
      return <span className="bracket-template fence">‖<BracketBox />‖</span>;
    case "brace":
      return <span className="bracket-template fence">{"{"}<BracketBox />{"}"}</span>;
    case "floor":
      return <span className="bracket-template fence">⌊<BracketBox />⌋</span>;
    case "ceil":
      return <span className="bracket-template fence">⌈<BracketBox />⌉</span>;
    case "corner":
      return <span className="bracket-template fence">⌜<BracketBox />⌝</span>;
    case "overline":
      return <span className="bracket-accent overline"><BracketBox /></span>;
    case "underline":
      return <span className="bracket-accent underline"><BracketBox /></span>;
    case "overbrace":
      return <span className="bracket-accent overbrace"><span>⏞</span><BracketBox /></span>;
    case "underbrace":
      return <span className="bracket-accent underbrace"><BracketBox /><span>⏟</span></span>;
    case "boxed":
    case "rect":
      return <span className="bracket-boxed-icon"><BracketBox /></span>;
    case "sqrtBox":
      return <span className="bracket-template sqrt">√<span className="bracket-root-line"><BracketBox /></span></span>;
    case "dot":
      return <span className="bracket-accent mark"><span>˙</span><BracketBox /></span>;
    case "ddot":
      return <span className="bracket-accent mark"><span>¨</span><BracketBox /></span>;
    case "hat":
      return <span className="bracket-accent mark"><span>ˆ</span><BracketBox /></span>;
    case "tilde":
      return <span className="bracket-accent mark"><span>˜</span><BracketBox /></span>;
    case "bar":
      return <span className="bracket-accent mark"><span>¯</span><BracketBox /></span>;
    case "vec":
      return <span className="bracket-accent mark"><span>→</span><BracketBox /></span>;
    case "breve":
      return <span className="bracket-accent mark"><span>˘</span><BracketBox /></span>;
    case "check":
      return <span className="bracket-accent mark"><span>ˇ</span><BracketBox /></span>;
    case "prime":
      return <span className="bracket-template prime"><BracketBox />′</span>;
    case "doublePrime":
      return <span className="bracket-template prime"><BracketBox />″</span>;
    case "widehat":
      return <span className="bracket-accent wide"><span>⌃</span><BracketBox /></span>;
    case "widetilde":
      return <span className="bracket-accent wide"><span>∼</span><BracketBox /></span>;
    case "leftBar":
      return <span className="bracket-template single">|<BracketBox /></span>;
    case "rightBar":
      return <span className="bracket-template single"><BracketBox />|</span>;
    case "leftBracket":
      return <span className="bracket-template single">[<BracketBox /></span>;
    case "rightBracket":
      return <span className="bracket-template single"><BracketBox />]</span>;
    case "leftBrace":
      return <span className="bracket-template single">{"{"}<BracketBox /></span>;
    case "rightBrace":
      return <span className="bracket-template single"><BracketBox />{"}"}</span>;
    case "circleBox":
      return <span className="bracket-circle-icon"><BracketBox small /></span>;
    case "squareBox":
      return <span className="bracket-square-symbol">□</span>;
    default:
      return item.d;
  }
}

function BracketSymbolPalette({ onInsert, onPlainInsert }) {
  const groups = BRACKET_SYMBOL_GROUPS;
  const handleInsert = (item) => {
    if (item.plain) onPlainInsert(item.l);
    else onInsert(item.l, symbolFallback(item));
  };

  return (
    <div className="bracket-symbol-board" aria-label="Brackets and accents">
      {groups.map((group, groupIndex) => (
        <RibbonPopupCluster
          key={`bracket-group-${groupIndex}`}
          group={group}
          popupItems={ribbonPopupItems(groups, groupIndex, BRACKET_POPUP_SYMBOL_GROUPS)}
          classPrefix="bracket-symbol"
          buttonClassName={(item) => `bracket-symbol-button ${item.icon ? "template" : ""}`}
          renderItem={(item) => <BracketIcon item={item} />}
          onPick={handleInsert}
          popupTitle="More bracket and accent symbols"
        />
      ))}
    </div>
  );
}

function OperatorBox({ small = false }) {
  return <span className={`large-operator-template-box ${small ? "small" : ""}`} />;
}

function LargeOperatorIcon({ item }) {
  switch (item.mode) {
    case "limits":
      return (
        <span className="large-operator-template stacked">
          <OperatorBox small />
          <span className="large-operator-symbol">{item.op}</span>
          <OperatorBox small />
        </span>
      );
    case "upper":
      return (
        <span className="large-operator-template side upper">
          <span className="large-operator-symbol">{item.op}</span>
          <OperatorBox small />
        </span>
      );
    case "lower":
      return (
        <span className="large-operator-template side lower">
          <span className="large-operator-symbol">{item.op}</span>
          <OperatorBox small />
        </span>
      );
    case "sideLimits":
      return (
        <span className="large-operator-template side-limits">
          <span className="large-operator-symbol">{item.op}</span>
          <span className="large-operator-side-stack">
            <OperatorBox small />
            <OperatorBox small />
          </span>
        </span>
      );
    case "large":
      return <span className="large-operator-symbol solo">{item.op}</span>;
    default:
      return <span className="large-operator-symbol">{item.op}</span>;
  }
}

function LargeOperatorPalette({ onInsert }) {
  const groups = LARGE_OPERATOR_SYMBOL_GROUPS;

  return (
    <div className="large-operator-board" aria-label="Large operators">
      {groups.map((group, groupIndex) => (
        <RibbonPopupCluster
          key={`large-operator-group-${groupIndex}`}
          group={group}
          popupItems={ribbonPopupItems(groups, groupIndex, LARGE_OPERATOR_POPUP_SYMBOL_GROUPS)}
          classPrefix="large-operator"
          buttonClassName="large-operator-button"
          renderItem={(item) => <LargeOperatorIcon item={item} />}
          onPick={(item) => onInsert(item.l, symbolFallback(item))}
          popupTitle="More large operator symbols"
        />
      ))}
    </div>
  );
}

function TemplateBox({ small = false }) {
  return <span className={`root-template-box ${small ? "small" : ""}`} />;
}

function RootFractionIcon({ type }) {
  switch (type) {
    case "fraction":
      return (
        <span className="root-template-icon root-template-fraction">
          <TemplateBox />
          <span className="root-template-line" />
          <TemplateBox />
        </span>
      );
    case "slashFraction":
      return (
        <span className="root-template-icon root-template-slash-fraction">
          <TemplateBox small />
          <span className="root-template-slash">/</span>
          <TemplateBox small />
        </span>
      );
    case "smallFraction":
      return (
        <span className="root-template-icon root-template-small-fraction">
          <TemplateBox small />
          <span className="root-template-line short" />
          <TemplateBox small />
        </span>
      );
    case "nestedFraction":
      return (
        <span className="root-template-icon root-template-nested-fraction">
          <span className="root-template-mini-stack">
            <TemplateBox small />
            <span className="root-template-line short" />
            <TemplateBox small />
          </span>
          <span className="root-template-line" />
          <TemplateBox small />
        </span>
      );
    case "sumDenominator":
      return (
        <span className="root-template-icon root-template-fraction">
          <TemplateBox small />
          <span className="root-template-line" />
          <span className="root-template-row">
            <TemplateBox small />
            <span>+</span>
            <TemplateBox small />
          </span>
        </span>
      );
    case "sumNumerator":
      return (
        <span className="root-template-icon root-template-fraction">
          <span className="root-template-row">
            <TemplateBox small />
            <span>+</span>
            <TemplateBox small />
          </span>
          <span className="root-template-line" />
          <TemplateBox small />
        </span>
      );
    case "sqrt":
      return (
        <span className="root-template-icon root-template-root">
          <span className="root-template-radical">√</span>
          <TemplateBox />
        </span>
      );
    case "nthRoot":
      return (
        <span className="root-template-icon root-template-root nth">
          <TemplateBox small />
          <span className="root-template-radical">√</span>
          <TemplateBox />
        </span>
      );
    case "cubeRoot":
      return (
        <span className="root-template-icon root-template-root nth">
          <span className="root-template-index">3</span>
          <span className="root-template-radical">√</span>
          <TemplateBox />
        </span>
      );
    case "fourthRoot":
      return (
        <span className="root-template-icon root-template-root nth">
          <span className="root-template-index">4</span>
          <span className="root-template-radical">√</span>
          <TemplateBox />
        </span>
      );
    case "rootFraction":
      return (
        <span className="root-template-icon root-template-root-fraction">
          <span className="root-template-root">
            <span className="root-template-radical">√</span>
            <TemplateBox small />
          </span>
          <span className="root-template-line" />
          <TemplateBox small />
        </span>
      );
    case "sup":
      return (
        <span className="root-template-icon root-template-script">
          <TemplateBox />
          <TemplateBox small />
        </span>
      );
    case "sub":
      return (
        <span className="root-template-icon root-template-script sub">
          <TemplateBox />
          <TemplateBox small />
        </span>
      );
    case "subsup":
      return (
        <span className="root-template-icon root-template-sub-sup">
          <TemplateBox />
          <span className="root-template-script-stack">
            <TemplateBox small />
            <TemplateBox small />
          </span>
        </span>
      );
    case "negativePower":
      return (
        <span className="root-template-icon root-template-negative-power">
          <TemplateBox />
          <span>-1</span>
        </span>
      );
    case "paren":
      return (
        <span className="root-template-icon root-template-fence">
          <span>(</span>
          <TemplateBox />
          <span>)</span>
        </span>
      );
    case "bracket":
      return (
        <span className="root-template-icon root-template-fence">
          <span>[</span>
          <TemplateBox />
          <span>]</span>
        </span>
      );
    case "absolute":
      return (
        <span className="root-template-icon root-template-fence">
          <span>|</span>
          <TemplateBox />
          <span>|</span>
        </span>
      );
    case "brace":
      return (
        <span className="root-template-icon root-template-fence">
          <span>{"{"}</span>
          <TemplateBox />
          <span>{"}"}</span>
        </span>
      );
    case "floor":
      return (
        <span className="root-template-icon root-template-fence">
          <span>⌊</span>
          <TemplateBox />
          <span>⌋</span>
        </span>
      );
    case "ceiling":
      return (
        <span className="root-template-icon root-template-fence">
          <span>⌈</span>
          <TemplateBox />
          <span>⌉</span>
        </span>
      );
    default:
      return null;
  }
}

function RootFractionTemplateButton({ item, onPick }) {
  return (
    <button
      type="button"
      title={item.t}
      className={`root-template-button ${item.sideLines ? "with-side-lines" : ""}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(item.l, symbolFallback(item))}
    >
      <RootFractionIcon type={item.icon} />
    </button>
  );
}

function RootFractionPalette({ onInsert }) {
  return (
    <div className="root-template-strip">
      {ROOT_FRACTION_MAIN.map((item) => (
        <RootFractionTemplateButton key={item.t} item={item} onPick={onInsert} />
      ))}
    </div>
  );
}

function SpecialCharacterPicker({ onPick }) {
  const pickerRef = useRef(null);
  const [open, setOpen] = useState(false);

  const [category, setCategory] = useState("symbol");
  const [selected, setSelected] = useState("$");
  const [code, setCode] = useState(characterCode("$"));
  const activeCharacters = SPECIAL_CHARACTER_GROUPS[category].chars;

  useEffect(() => {
    if (!open) return;

    const closeWhenOutside = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && (pickerRef.current?.contains(target) || target.closest(".special-symbol-panel"))) return;
      setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeWhenOutside, true);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside, true);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (char) => {
    setSelected(char);
    setCode(characterCode(char));
    onPick(char);
  };

  const insertCode = () => {
    const char = charFromCode(code);
    if (!char) return;
    choose(char);
  };

  const changeCategory = (nextCategory) => {
    const firstChar = SPECIAL_CHARACTER_GROUPS[nextCategory].chars[0] || "";
    setCategory(nextCategory);
    setSelected(firstChar);
    setCode(firstChar ? characterCode(firstChar) : "");
  };

  return (
    <div className="special-symbol-picker" ref={pickerRef}>
      <button
        type="button"
        title="Special character"
        className={`math-ribbon-mini rich special-symbol-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen(value => !value)}
      >
        Ω
      </button>

      <FloatingPanel anchorRef={pickerRef} open={open} className="special-symbol-panel" offset={6}>
          <div className="special-symbol-header">
            <label className="special-symbol-code-label" htmlFor="special-symbol-code">Code:</label>
            <input
              id="special-symbol-code"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  insertCode();
                }
              }}
              className="special-symbol-code"
              title={`Selected ${selected}`}
            />
            <select
              className="special-symbol-select"
              value={category}
              onChange={e => changeCategory(e.target.value)}
            >
              {Object.entries(SPECIAL_CHARACTER_GROUPS).map(([value, group]) => (
                <option key={value} value={value}>{group.label}</option>
              ))}
            </select>
          </div>

          <div className="special-symbol-grid" role="listbox" aria-label="Special characters">
            {activeCharacters.map((char, index) => (
              <button
                key={`${char}-${index}`}
                type="button"
                title={`${char} ${characterCode(char)}`}
                className={`special-symbol-cell ${selected === char ? "active" : ""}`}
                onMouseEnter={() => {
                  setSelected(char);
                  setCode(characterCode(char));
                }}
                onFocus={() => {
                  setSelected(char);
                  setCode(characterCode(char));
                }}
                onClick={() => choose(char)}
              >
                {char}
              </button>
            ))}
          </div>
      </FloatingPanel>
    </div>
  );
}

function MatrixEditor({ latex, onChange, inCanvas = false, fontSize = 20 }) {
  const matrix = parseMatrixLatex(latex) || parseMatrixLatex(buildMatrixLatex(3, 3, "bmatrix"));
  const maxSize = 5;
  const cellSize = inCanvas ? Math.max(15, Math.min(35, fontSize * 1.35)) : 35;
  const inputSize = Math.max(20, cellSize - 2);
  const envButtons = [
    { env: "bmatrix", label: "[ ]", title: "Square brackets" },
    { env: "pmatrix", label: "( )", title: "Parentheses" },
    { env: "vmatrix", label: "| |", title: "Determinant" },
    { env: "matrix", label: "none", title: "No brackets" },
  ];
  const clamp = (value) => Math.min(Math.max(Number(value) || 1, 1), maxSize);
  const update = (rows = matrix.rows, env = matrix.env) => onChange(serializeMatrixLatex(rows, env));
  const updateSize = (rowCount, colCount) => update(resizeMatrixRows(matrix, clamp(rowCount), clamp(colCount)));
  const updateCell = (rowIndex, colIndex, value) => {
    const rows = matrix.rows.map(row => [...row]);
    rows[rowIndex][colIndex] = value;
    update(rows);
  };

  return (
    <div className={`matrix-editor ${inCanvas ? "in-canvas" : ""}`}>
      {!inCanvas && (
        <div className="matrix-editor-toolbar">
          {envButtons.map(button => (
            <button
              key={button.env}
              type="button"
              title={button.title}
              onClick={()=>update(matrix.rows, button.env)}
              className={`matrix-editor-env-button ${matrix.env===button.env ? "active" : ""}`}
            >
              {button.label}
            </button>
          ))}

          <span className="matrix-editor-label offset">Rows</span>
          <input
            type="number"
            min={1}
            max={maxSize}
            value={matrix.rows.length}
            onChange={e=>updateSize(e.target.value, matrix.colCount)}
            className="matrix-editor-size-input"
          />

          <span className="matrix-editor-label">Columns</span>
          <input
            type="number"
            min={1}
            max={maxSize}
            value={matrix.colCount}
            onChange={e=>updateSize(matrix.rows.length, e.target.value)}
            className="matrix-editor-size-input"
          />
        </div>
      )}

      <div className={`meq-matrix-wrap meq-matrix-edit-wrap meq-matrix-${matrix.env}`}>
        <div
          className="meq-matrix-edit-grid"
          style={{ "--matrix-cols": matrix.colCount, "--matrix-cell-size": `${cellSize}px` }}
        >
          {matrix.rows.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <input
                key={`${rowIndex}-${colIndex}`}
                value={cell}
                aria-label={`Matrix row ${rowIndex + 1} column ${colIndex + 1}`}
                onChange={e=>updateCell(rowIndex, colIndex, e.target.value)}
                className="matrix-editor-cell-input"
                style={{
                  "--matrix-input-size": `${inputSize}px`,
                  "--matrix-input-font-size": `${inCanvas ? fontSize * 0.9 : 14}px`,
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Multiline equation area (shared by both modals)
// ════════════════════════════════════════════════════════════════════════════
function EquationArea({ accent="blue", lines, setLines, activeLine, setActiveLine,
  lineRefs, mqRefs, MQ, fontSize=14, minHeight=190, matrixLatexes=[], setMatrixLatexAt,
  textDirection="ltr", matrixVersion=0 }) {
  const editingMatrix = Boolean(matrixLatexes.length && setMatrixLatexAt);
  const isRtl = textDirection === "rtl";

  const handleKey = (e,i) => {
    if (e.key==="Enter") {
      e.preventDefault();
      const n=[...lines]; n.splice(i+1,0,"");
      setLines(n); mqRefs.current.splice(i+1); lineRefs.current.splice(i+1); setActiveLine(i+1);
    } else if (e.key==="Backspace"&&mqRefs.current[i]?.latex()===""&&lines.length>1) {
      e.preventDefault();
      setLines(lines.filter((_,idx)=>idx!==i));
      mqRefs.current.splice(i,1); lineRefs.current.splice(i,1); setActiveLine(Math.max(0,i-1));
    } else if (e.key==="ArrowUp"&&i>0) setActiveLine(i-1);
    else if (e.key==="ArrowDown"&&i<lines.length-1) setActiveLine(i+1);
  };

  return (
    <div
      dir={textDirection}
      className="equation-area"
      style={{ "--equation-area-min-height": `${minHeight}px` }}
    >
      {/* Equation lines */}
      <div className="equation-area-scroll">
        {editingMatrix ? (
          <div
            className="equation-matrix-canvas"
            style={{ "--equation-matrix-min-height": `${minHeight - 22}px` }}
          >
            {matrixLatexes.map((latex, matrixIndex) => (
              <MatrixEditor
                key={`${matrixVersion}-${matrixIndex}`}
                latex={latex}
                onChange={(nextLatex) => setMatrixLatexAt(matrixIndex, nextLatex)}
                inCanvas
                fontSize={fontSize}
              />
            ))}
          </div>
        ) : !MQ && (
          <div className="equation-loading">
            Loading equation editor…
          </div>
        )}
        {!editingMatrix && MQ && lines.map((_,i)=>(
          <div key={i} onClick={()=>setActiveLine(i)}
            className="equation-line-row">
            <span ref={el=>lineRefs.current[i]=el}
              onKeyDown={e=>handleKey(e,i)}
              className="equation-line-field"
              style={{ "--equation-line-font-size": `${fontSize}px` }}/>
          </div>
        ))}
        {/* Empty space to click and add lines */}
        {!editingMatrix && MQ && (
          <div className="equation-add-line">
            <button type="button"
              onClick={()=>{
                setLines(p=>[...p,""]);
                mqRefs.current.splice(lines.length);
                lineRefs.current.splice(lines.length);
                setActiveLine(lines.length);
              }}
              className="equation-add-line-button">
              
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Math Modal
// ════════════════════════════════════════════════════════════════════════════
function MathModal({ onInsert, onClose, initialLatex = "", submitLabel = "✓ Insert Equation" }) {
  const initialMatrix = parseMatrixLatex(initialLatex) ? initialLatex : "";
  const [grp,setGrp]   = useState(0);
  const [font,setFont] = useState("serif");
  const [size,setSize] = useState(16);
  const [editorDirection,setEditorDirection] = useState("ltr");
  const [matrixLatexes,setMatrixLatexes] = useState(() => initialMatrix ? [initialMatrix] : []);
  const [matrixVersion,setMatrixVersion] = useState(0);
  const [lines,setLines]           = useState(() => {
    if (initialMatrix) return [""];
    const initialLines = splitEquationLines(initialLatex);
    return initialLines.length ? initialLines : [""];
  });
  const [activeLine,setActiveLine] = useState(0);
  const lineRefs = useRef([]);
  const mqRefs   = useRef([]);
  const [MQ,setMQ] = useState(null);
  const hasMatrix = matrixLatexes.length > 0;
  const matrixLatex = matrixLatexes.join("\\,");

  useEffect(()=>{
    let c=false;
    loadMQ().then(mq=>{ if(!c) setMQ(()=>mq); });
    return()=>{ c=true; };
  },[]);

  useEffect(()=>{
    if(!MQ) return;
    if(hasMatrix) return;
    lines.forEach((lt,i)=>{
      if(!lineRefs.current[i]||mqRefs.current[i]) return;
      const mq=MQ.MathField(lineRefs.current[i],{
        spaceBehavesLikeTab:false,
        handlers:{edit:f=>setLines(p=>p.map((l,idx)=>idx===i?f.latex():l))},
      });
      mq.latex(lt||""); mqRefs.current[i]=mq;
    });
  },[MQ,lines.length,hasMatrix]);

  useEffect(()=>{
    if(hasMatrix) return;
    setTimeout(()=>mqRefs.current[activeLine]?.focus(),30);
  },[activeLine,lines.length,hasMatrix]);

  const resetMathFields = () => {
    setLines([""]);
    mqRefs.current=[];
    lineRefs.current=[];
    setActiveLine(0);
  };
  const appendMatrix = (l) => {
    setMatrixLatexes(previous => [...previous, l]);
    setMatrixVersion(value => value + 1);
    resetMathFields();
  };
  const setMatrixLatexAt = (matrixIndex, nextLatex) => {
    setMatrixLatexes(previous => previous.map((latex, index) => index === matrixIndex ? nextLatex : latex));
  };

  const ins = (l, fallbackText = "") => {
    if (parseMatrixLatex(l)) {
      appendMatrix(l);
      return;
    }

    if (hasMatrix) {
      setMatrixLatexes([]);
      resetMathFields();
      setTimeout(()=>mqInsert(mqRefs.current[0], l, fallbackText),60);
      return;
    }
    setMatrixLatexes([]);
    mqInsert(mqRefs.current[activeLine], l, fallbackText);
  };
  const insertSpecialChar = char => {
    if (hasMatrix) {
      setMatrixLatexes([]);
      resetMathFields();
      setTimeout(()=>mqInsertPlainText(mqRefs.current[0], char),60);
      return;
    }
    setMatrixLatexes([]);
    mqInsertPlainText(mqRefs.current[activeLine], char);
  };
  const chooseMatrix = l => {
    appendMatrix(l);
  };
  const clr = () => { setMatrixLatexes([]); resetMathFields(); };
  const toggleEditorDirection = () => {
    setEditorDirection(d => d === "rtl" ? "ltr" : "rtl");
    setTimeout(()=>mqRefs.current[activeLine]?.focus(),30);
  };
  const full = matrixLatex || lines.join(" \\\\ ");
  const has  = matrixLatex.trim()!=="" || lines.some(l=>l.trim()!=="");
  const isRootsGroup = MATH_GROUPS[grp].label === "Roots & Fractions";
  const isArrowGroup = MATH_GROUPS[grp].label === "Arrow Symbols";
  const isScriptLayoutGroup = MATH_GROUPS[grp].label === "Scripts & Layouts";
  const isBracketGroup = MATH_GROUPS[grp].label === "Brackets & Accents";
  const isLargeOperatorGroup = MATH_GROUPS[grp].label === "Large Operators";
  const isCalculusGroup = MATH_GROUPS[grp].label === "Calculus";
  const isMatrixGroup = MATH_GROUPS[grp].label === "Matrices & Vectors";

  return (
    <ModalShell
      title="√ MathType — Equation Editor"
      accent="blue"
      onClose={onClose}
      width="min(560px, calc(100vw - 12px))"
      maxHeight="min(470px, 100vh)"
    >
      <div className="math-ribbon">
        <div className="math-ribbon-tabs">
          {MATH_GROUPS.map((g,i)=>(
            <button
              key={g.label}
              type="button"
              title={g.label}
              onClick={()=>setGrp(i)}
              className={`math-ribbon-tab ${grp===i ? "active" : ""}`}
            >
              <span className="math-ribbon-tab-main">{g.icon}</span>
              <span className="math-ribbon-tab-mini">{RIBBON_MINI[g.label] || g.icon}</span>
            </button>
          ))}
          <button type="button" title="Clear" onClick={clr} className="math-ribbon-tab math-ribbon-clear">
            ↶
          </button>
        </div>

        <div className="math-ribbon-body">
            
          <div className={`math-ribbon-palette ${isRootsGroup ? "roots-fraction-palette" : ""} 
          ${isArrowGroup ? "arrow-symbol-palette" : ""} 
          ${isScriptLayoutGroup ? "script-layout-palette" : ""}
           ${isBracketGroup ? "bracket-symbol-palette" : ""}
            ${isLargeOperatorGroup ? "large-operator-palette" : ""}
             ${isCalculusGroup ? "calculus-symbol-palette" : ""}
             ${isMatrixGroup ? "matrix-symbol-palette" : ""}`}>
            {isRootsGroup ? (
              <RootFractionPalette onInsert={ins} />
            ) : isArrowGroup ? (
              <ArrowSymbolPalette onInsert={ins} onPlainInsert={insertSpecialChar} />
            ) : isScriptLayoutGroup ? (
              <ScriptLayoutPalette onInsert={ins} onPlainInsert={insertSpecialChar} />
            ) : isBracketGroup ? (
              <BracketSymbolPalette onInsert={ins} onPlainInsert={insertSpecialChar} />
            ) : isLargeOperatorGroup ? (
              <LargeOperatorPalette onInsert={ins} />
            ) : isCalculusGroup ? (
              <CalculusSymbolPalette onInsert={ins} onPlainInsert={insertSpecialChar} />
            ) : isMatrixGroup ? (
              <MatrixSymbolPalette
                items={MATH_GROUPS[grp].items}
                onInsert={ins}
                onMatrix={chooseMatrix}
                
              />

            ) : (
              <GenericSymbolPalette
                items={MATH_GROUPS[grp].items}
                onInsert={ins}
                onMatrix={chooseMatrix}
              />
            )}
          </div>

          {isRootsGroup && (
            <>
              <div className="math-ribbon-sep" />

              <div className="math-ribbon-quick roots-fraction-quick">
                {ROOT_QUICK_SYMBOLS.map((b,i)=>(
                  <button
                    key={`${b.d}-${i}`}
                    type="button"
                    title={b.d}
                    className="math-ribbon-mini"
                    onClick={()=>ins(b.l, b.d)}
                  >
                    {b.d}
                  </button>
                ))}
                <button type="button" title="Bold math" className="math-ribbon-mini rich" onClick={()=>ins("\\mathbf{}", "B")}>
                  <b>B</b>
                </button>
                <button type="button" title="Italic math" className="math-ribbon-mini rich" onClick={()=>ins("\\mathit{}", "I")}>
                  <i>1b</i>
                </button>
                <button type="button" title="Blackboard" className="math-ribbon-mini rich" onClick={()=>ins("\\mathbb{}", "R")}>
                  T
                </button>
              </div>

              <div className="math-ribbon-sep" />

              <div className="math-ribbon-format">
                <select value={font} onChange={e=>setFont(e.target.value)} className="math-ribbon-select">
                  {["serif","Arial","Courier New","Times New Roman"].map(f=><option key={f}>{f}</option>)}
                </select>
                <select value={size} onChange={e=>setSize(+e.target.value)} className="math-ribbon-select small">
                  {[12,13,14,15,16,18,20,24].map(s=><option key={s}>{s}</option>)}
                </select>
                <button
                  type="button"
                  title={editorDirection==="rtl" ? "Switch to left-to-right editing" : "Switch to right-to-left editing"}
                  className={`math-ribbon-direction ${editorDirection==="rtl" ? "active" : ""}`}
                  onClick={toggleEditorDirection}
                >
                  {editorDirection==="rtl" ? "س" : "س"}
                </button>
              </div>
            </>
          )}

          <button
            type="button"
            title={hasMatrix ? "Clear matrices" : "Delete last"}
            className="math-ribbon-backspace"
            onClick={()=>hasMatrix ? setMatrixLatexes([]) : mqRefs.current[activeLine]?.keystroke("Backspace")}
          >
            {hasMatrix ? "Clear matrices" : "↩"}
          </button>
        </div>
      </div>

      {/* Equation editing area */}
      <EquationArea accent="blue" lines={lines} setLines={setLines}
        activeLine={activeLine} setActiveLine={setActiveLine}
        lineRefs={lineRefs} mqRefs={mqRefs} MQ={MQ} fontSize={size} minHeight={160}
        matrixLatexes={matrixLatexes} setMatrixLatexAt={setMatrixLatexAt}
        textDirection={editorDirection} matrixVersion={matrixVersion} />

      {/* Bottom status + actions */}
      <div className="modal-actions-footer">
       
          <button type="button" onClick={()=>has&&onInsert(full)} disabled={!has}
            className="modal-action-button primary blue">
            {submitLabel}
          </button>

        <div className="modal-actions-group">
          <button type="button" onClick={onClose}
            className="modal-action-button secondary">
            Cancel
          </button>
          
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Chem Modal
// ════════════════════════════════════════════════════════════════════════════
function ChemModal({ onInsert, onClose, initialLatex = "", submitLabel = "✓ Insert Equation" }) {
  const [grp,setGrp] = useState(0);
  const [lines,setLines]           = useState(() => {
    const initialLines = splitEquationLines(initialLatex);
    return initialLines.length ? initialLines : [""];
  });
  const [activeLine,setActiveLine] = useState(0);
  const lineRefs = useRef([]);
  const mqRefs   = useRef([]);
  const [MQ,setMQ] = useState(null);

  useEffect(()=>{ let c=false; loadMQ().then(mq=>{ if(!c) setMQ(()=>mq); }); return()=>{ c=true; }; },[]);

  useEffect(()=>{
    if(!MQ) return;
    lines.forEach((lt,i)=>{
      if(!lineRefs.current[i]||mqRefs.current[i]) return;
      const mq=MQ.MathField(lineRefs.current[i],{
        spaceBehavesLikeTab:false,
        handlers:{edit:f=>setLines(p=>p.map((l,idx)=>idx===i?f.latex():l))},
      });
      mq.latex(lt||""); mqRefs.current[i]=mq;
    });
  },[MQ,lines.length]);

  useEffect(()=>{ setTimeout(()=>mqRefs.current[activeLine]?.focus(),30); },[activeLine,lines.length]);

  const ins = (l, fallbackText = "") => mqInsert(mqRefs.current[activeLine], l, fallbackText);
  const clr = () => { setLines([""]); mqRefs.current=[]; lineRefs.current=[]; setActiveLine(0); };
  const full = lines.join(" \\\\ ");
  const has  = lines.some(l=>l.trim()!=="");

  return (
  <ModalShell
    title=" ChemType — Chemistry Equation Editor"
    accent="green"
    onClose={onClose}
    width="min(500px, 100vw)"
    maxHeight="min(470px, 100vh)"
  >
      {/* Group tabs */}
      <div className="chem-symbol-palette">
        {CHEM_GROUPS[grp].items.map((it, i) => (
  <button
    key={i}
    type="button"
    title={it.t}
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => ins(it.l, symbolFallback(it))}
    className="chem-symbol-button"
  >
    {it.d}
  </button>
))}
        <button type="button" onClick={clr}
          className="chem-clear-button">🗑 Clear</button>
      </div>

      {/* Compound palette */}
    

      {/* Quick chem operators */}
      <div className="chem-quick-toolbar">
        {[
          {d:"→",l:"\\rightarrow"},{d:"⇌",l:"\\rightleftharpoons"},
          {d:"↑",l:"\\uparrow"},{d:"↓",l:"\\downarrow"},
          {d:"+",l:"+"},{d:"·",l:"\\cdot"},
          {d:"⁺",l:"^{+}"},{d:"⁻",l:"^{-}"},
          {d:"²⁺",l:"^{2+}"},{d:"²⁻",l:"^{2-}"},
          {d:"Δ",l:"\\Delta"},{d:"°",l:"^{\\circ}"},
        ].map((b,i)=>(
          <SB key={i} title={b.d} onClick={()=>ins(b.l, b.d)} color="#166534" bg="#f0fdf4">{b.d}</SB>
        ))}        
        <button type="button" title="Delete last" onClick={()=>mqRefs.current[activeLine]?.keystroke("Backspace")}
          className="chem-backspace-button">↩ Backspace</button>
      </div>

      <EquationArea accent="green" lines={lines} setLines={setLines}
        activeLine={activeLine} setActiveLine={setActiveLine}
        lineRefs={lineRefs} mqRefs={mqRefs} MQ={MQ} fontSize={15} minHeight={160} />

      <div className="modal-actions-footer">
        <span className="chem-footer-status">
         
          
        </span>
        <div className="modal-actions-group push-right">
          <button type="button" onClick={onClose}
            className="modal-action-button secondary chem">
            Cancel
          </button>
          <button type="button" onClick={()=>has&&onInsert(full)} disabled={!has}
            className="modal-action-button primary green">
            {submitLabel}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Toolbar button component with hover + active + tooltip
// ════════════════════════════════════════════════════════════════════════════
function TBtn({ children, onClick, title, active=false, disabled=false, special, wide=false }) {
  const [tip, setTip] = useState(false);
  const classes = [
    "editor-tool-button",
    wide ? "wide" : "",
    active ? "active" : "",
    special ? `special-${special}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="editor-tool-wrap">
      <button type="button" onClick={disabled?undefined:onClick}
        title={undefined}
        disabled={disabled}
        onMouseEnter={()=>{ if(!disabled) setTip(true); }}
        onMouseLeave={()=>setTip(false)}
        className={classes}>
        {children}
      </button>
      {/* Tooltip */}
      {tip && title && (
        <div className="editor-tooltip">
          {title}
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <div className="editor-separator"/>;
}

// ════════════════════════════════════════════════════════════════════════════
// Main RichTextEditor
// ════════════════════════════════════════════════════════════════════════════
export default function RichTextEditor({
  value="", onChange, placeholder="Enter your answer here…", readOnly=false
}) {
  const editorRef  = useRef(null);
  const savedRange = useRef(null);
  const [modal,    setModal]    = useState(null);
  const [editTarget,setEditTarget] = useState(null);
  const [focused,  setFocused]  = useState(false);
  const [wordCount,setWordCount]= useState(0);
  const [textDirection,setTextDirection] = useState(() =>
    /dir=["']rtl["']|direction\s*:\s*rtl/i.test(value) ? "س" : "س"
  );

  useEffect(()=>{
    if(editorRef.current&&value&&editorRef.current.innerHTML!==value){
      editorRef.current.innerHTML=value;
      renderMath();
    }
  },[]);

  const renderMath = async () => {
    const el=editorRef.current; if(!el) return;
    const spans=el.querySelectorAll(".meq[data-l]");
    if(!spans.length) return;
    const MQ=await loadMQ();
    spans.forEach(sp=>{
      const lt=sp.getAttribute("data-l"); if(!lt) return;
      renderStaticEquation(MQ, sp, lt);
    });
  };

  const saveSelection=()=>{
    const s=window.getSelection();
    if(!s||s.rangeCount===0) return;
    const range=s.getRangeAt(0);
    if(isEditorRange(range)) savedRange.current=range.cloneRange();
  };
  const restoreSelection=()=>{
    const s=window.getSelection();
    if(savedRange.current&&s&&isEditorRange(savedRange.current)){
      s.removeAllRanges();
      s.addRange(savedRange.current);
    }
  };
  const isEditorNode=(node)=>{
    const editor=editorRef.current;
    if(!editor||!node) return false;
    const target=node.nodeType===Node.TEXT_NODE?node.parentNode:node;
    return target===editor||editor.contains(target);
  };
  const isEditorRange=(range)=>{
    if(!range) return false;
    return isEditorNode(range.startContainer)&&isEditorNode(range.endContainer);
  };
  const getInsertionRange=()=>{
    restoreSelection();
    const s=window.getSelection();
    if(s&&s.rangeCount>0&&isEditorRange(s.getRangeAt(0))) return s.getRangeAt(0);

    const editor=editorRef.current;
    if(!editor) return null;
    const range=document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    if(s){
      s.removeAllRanges();
      s.addRange(range);
    }
    savedRange.current=range.cloneRange();
    return range;
  };
  const closeModal=()=>{
    setModal(null);
    setEditTarget(null);
  };
  const openEquationEditor=(equationEl)=>{
    if(!equationEl||!editorRef.current?.contains(equationEl)) return;

    const type=equationEl.getAttribute("data-t")==="chem" ? "chem" : "math";
    setEditTarget({
      node: equationEl,
      type,
      latex: equationEl.getAttribute("data-l") || "",
    });
    setModal(type);
  };
  const handleEditorClick=(e)=>{
    const target=e.target instanceof Element ? e.target : e.target?.parentElement;
    const equationEl=target?.closest?.(".meq");
    if(!equationEl||!editorRef.current?.contains(equationEl)) return;

    e.preventDefault();
    e.stopPropagation();
    openEquationEditor(equationEl);
  };

  const insertEquation=async(latex,type)=>{
    const MQ=await loadMQ();
    const span=document.createElement("span");
    span.contentEditable="false";
    span.className="meq mqr";
    span.setAttribute("data-l",latex);
    span.setAttribute("data-t",type);
    renderStaticEquation(MQ, span, latex);
    if(editTarget?.node&&editorRef.current?.contains(editTarget.node)){
      editTarget.node.replaceWith(span);
      const range=document.createRange();
      range.setStartAfter(span);
      range.setEndAfter(span);
      const sel=window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      savedRange.current=range.cloneRange();
      editorRef.current?.focus();
      onChange&&onChange(editorRef.current?.innerHTML||"");
      closeModal();
      return;
    }

    const r=getInsertionRange();
    if(r){
      const space=document.createTextNode(" ");
      r.deleteContents();
      r.insertNode(space);
      r.insertNode(span);
      r.setStartAfter(space);
      r.setEndAfter(space);
      const sel=window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
      savedRange.current=r.cloneRange();
    } else {
      editorRef.current?.appendChild(span);
    }
    editorRef.current?.focus();
    onChange&&onChange(editorRef.current?.innerHTML||"");
    closeModal();
  };

  const exec=(cmd,val=null)=>{
    restoreSelection(); editorRef.current?.focus();
    document.execCommand(cmd,false,val);
    onChange&&onChange(editorRef.current?.innerHTML||"");
  };
  const toggleDirection=()=>{
    const nextDirection=textDirection==="rtl" ? "ltr" : "rtl";
    const alignCommand=nextDirection==="rtl" ? "justifyRight" : "justifyLeft";

    setTextDirection(nextDirection);
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(alignCommand,false,null);
    saveSelection();
    onChange&&onChange(editorRef.current?.innerHTML||"");
  };

  const handleInput=()=>{
    const html=editorRef.current?.innerHTML||"";
    onChange&&onChange(html);
    const text=editorRef.current?.innerText||"";
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length);
  };

  // ReadOnly
  if(readOnly){
    return(
      <div ref={el=>{
        if(!el) return;
        el.querySelectorAll(".meq[data-l]").forEach(async sp=>{
          const lt=sp.getAttribute("data-l"); if(!lt) return;
          const MQ=await loadMQ(); renderStaticEquation(MQ, sp, lt);
        });
      }}
      dangerouslySetInnerHTML={{__html:value}}
      className="rich-text-readonly"/>
    );
  }

  return(
    <div className={`rich-text-editor ${focused ? "focused" : ""}`}>

      {/* ═══ PREMIUM TOOLBAR ═══ */}
      <div className="rich-text-toolbar">

        {/* History */}
        <TBtn title="Undo (Ctrl+Z)" onClick={()=>exec("undo")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M3 7v6h6"/><path d="M3 13C5 8 9 5 14 5c5 0 8 3.5 8 8s-3 8-8 8c-3 0-5.5-1.5-7-4"/>
          </svg>
        </TBtn>
        <TBtn title="Redo (Ctrl+Y)" onClick={()=>exec("redo")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 7v6h-6"/><path d="M21 13C19 8 15 5 10 5c-5 0-8 3.5-8 8s3 8 8 8c3 0 5.5-1.5 7-4"/>
          </svg>
        </TBtn>
        <Sep/>

        {/* Text formatting */}
        <TBtn title="Bold (Ctrl+B)" onClick={()=>exec("bold")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z"/><path d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z"/>
          </svg>
        </TBtn>
        <TBtn title="Italic (Ctrl+I)" onClick={()=>exec("italic")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/>
            <line x1="15" y1="4" x2="9" y2="20"/>
          </svg>
        </TBtn>
        <TBtn title="Underline (Ctrl+U)" onClick={()=>exec("underline")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 3v7a6 6 0 006 6 6 6 0 006-6V3"/><line x1="4" y1="21" x2="20" y2="21"/>
          </svg>
        </TBtn>
        <TBtn title="Strikethrough" onClick={()=>exec("strikeThrough")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="4" y1="12" x2="20" y2="12"/>
            <path d="M8 6h8M8 18h8"/>
          </svg>
        </TBtn>
        <Sep/>

        {/* Font size */}
        <select title="Font size"
          onChange={e=>exec("fontSize",{"12px":"2","14px":"3","16px":"4","18px":"5","20px":"6"}[e.target.value]||"3")}
          defaultValue="14px"
          className="rich-text-font-size-select">
          {["12px","14px","16px","18px","20px","24px"].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <Sep/>

        {/* Alignment */}
        <TBtn title="Align Left" onClick={()=>exec("justifyLeft")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/>
            <line x1="3" y1="18" x2="18" y2="18"/>
          </svg>
        </TBtn>
        <TBtn title="Align Center" onClick={()=>exec("justifyCenter")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>
        </TBtn>
        <TBtn title="Align Right" onClick={()=>exec("justifyRight")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/>
            <line x1="6" y1="18" x2="21" y2="18"/>
          </svg>
        </TBtn>
        <TBtn
          title={textDirection==="rtl" ? "Switch to left-to-right editing" : "Right-to-left editing"}
          active={textDirection==="rtl"}
          onClick={toggleDirection}
        >
          <span className="rich-text-rtl-label">RTL</span>
        </TBtn>
        <Sep/>

        {/* Lists */}
        <TBtn title="Bullet List" onClick={()=>exec("insertUnorderedList")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/>
            <line x1="9" y1="18" x2="20" y2="18"/>
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
        </TBtn>
        <TBtn title="Numbered List" onClick={()=>exec("insertOrderedList")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="10" y1="6" x2="20" y2="6"/><line x1="10" y1="12" x2="20" y2="12"/>
            <line x1="10" y1="18" x2="20" y2="18"/>
            <text x="2" y="8" fontSize="6" fill="currentColor" stroke="none">1</text>
            <text x="2" y="14" fontSize="6" fill="currentColor" stroke="none">2</text>
            <text x="2" y="20" fontSize="6" fill="currentColor" stroke="none">3</text>
          </svg>
        </TBtn>
        <Sep/>

        {/* Text color */}
        <div className="rich-text-color-picker" title="Text Color">
          <label className="rich-text-color-label"
            title="Text color">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
              <path d="M9 3L5 21M15 3l4 18M5 12h14"/>
            </svg>
            <input type="color" onChange={e=>exec("foreColor",e.target.value)}
              className="rich-text-color-input"/>
          </label>
        </div>

        {/* Clear formatting */}
        <TBtn title="Clear formatting" onClick={()=>exec("removeFormat")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M7 21h14"/><path d="M9 3h10l-4 7h4L5 21l3-7H4l5-11z"/>
          </svg>
        </TBtn>
        <Sep/>

        {/* ── MATH button ── */}
        <TBtn title="Insert Math Equation" special="math" wide
          onClick={()=>{ saveSelection(); setEditTarget(null); setModal("math"); }}>
          <span className="rich-text-tool-icon math">√</span>
          <span className="rich-text-tool-label">Math</span>
        </TBtn>

        {/* ── CHEM button ── */}
        <TBtn title="Insert Chemistry Equation" special="chem" wide
          onClick={()=>{ saveSelection(); setEditTarget(null); setModal("chem"); }}>
          <span className="rich-text-tool-icon chem">⚗</span>
          <span className="rich-text-tool-label">Chem</span>
        </TBtn>
      </div>

      {/* ═══ EDITING AREA ═══ */}
      <div
        ref={editorRef}
        contentEditable
        dir={textDirection}
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={()=>setFocused(true)}
        onBlur={()=>setFocused(false)}
        onClick={handleEditorClick}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        className="rich-text-content"
        data-placeholder={placeholder}
      />

      {/* Placeholder */}
      {!value && (
        <div className="rich-text-placeholder">
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="rich-text-footer">
        <div className="rich-text-footer-group">
         
           
        </div>
        
      </div>

      {/* Modals */}
      {modal==="math" && (
        <MathModal
          key={`math-${editTarget?.latex || "new"}`}
          initialLatex={editTarget?.type==="math" ? editTarget.latex : ""}
          submitLabel={editTarget ? "✓ Update Equation" : "✓ Insert Equation"}
          onInsert={l=>insertEquation(l,"math")}
          onClose={closeModal}
        />
      )}
      {modal==="chem" && (
        <ChemModal
          key={`chem-${editTarget?.latex || "new"}`}
          initialLatex={editTarget?.type==="chem" ? editTarget.latex : ""}
          submitLabel={editTarget ? "✓ Update Equation" : "✓ Insert Equation"}
          onInsert={l=>insertEquation(l,"chem")}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
