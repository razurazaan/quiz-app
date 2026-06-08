
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./MathType.css";
import "./Matheditor.css";
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
const mqInsert = (mq, latex) => {
  if (!mq) return;
  // Try to write the latex directly
  mq.write(latex);
  mq.focus();
};
const mqInsertPlainText = (mq, text) => {
  if (!mq) return;
  if (typeof mq.typedText === "function") mq.typedText(text);
  else mq.write(text);
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
  const match = String(latex).trim().match(/^\\begin\{(bmatrix|pmatrix|vmatrix|matrix)\}([\s\S]*)\\end\{\1\}$/);
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
  const lines = splitEquationLines(latex);

  el.style.background = "transparent";
  el.style.backgroundColor = "transparent";
  el.style.borderColor = "transparent";
  el.innerHTML = "";
  el.classList.toggle("meq-multiline", lines.length > 1);
  el.classList.toggle("meq-matrix-wrap", Boolean(matrix));
  ["bmatrix", "pmatrix", "vmatrix", "matrix"].forEach(env =>
    el.classList.toggle(`meq-matrix-${env}`, matrix?.env === env)
  );

  if (matrix) {
    renderMatrixElement(MQ, el, matrix);
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
const MATH_GROUPS = [
  { icon:"√", label:"Roots & Fractions", items:[
    {d:"a/b",l:"\\frac{a}{b}",t:"Fraction"},{d:"√x",l:"\\sqrt{x}",t:"Square root"},
    {d:"x²",l:"x^{2}",t:"Square"},{d:"xⁿ",l:"x^{n}",t:"Power n"},
    {d:"∛x",l:"\\sqrt[3]{x}",t:"Cube root"},{d:"1/x",l:"\\frac{1}{x}",t:"Reciprocal"},
    {d:"|x|",l:"\\left|x\\right|",t:"Absolute value"},{d:"⌊x⌋",l:"\\lfloor x\\rfloor",t:"Floor"},
    {d:"⌈x⌉",l:"\\lceil x\\rceil",t:"Ceiling"},{d:"a/b/c",l:"\\frac{\\frac{a}{b}}{c}",t:"Nested fraction"},
    {d:"ⁿ√x",l:"\\sqrt[n]{x}",t:"Nth root"},{d:"√a/b",l:"\\frac{\\sqrt{a}}{b}",t:"Root over denominator"},
    {d:"a/(b+c)",l:"\\frac{a}{b+c}",t:"Fraction with sum denominator"},{d:"(a+b)/c",l:"\\frac{a+b}{c}",t:"Sum over c"},
    {d:"x⁻¹",l:"x^{-1}",t:"Negative power"},{d:"xₙ",l:"x_{n}",t:"Subscript n"},
    {d:"xₙᵐ",l:"x_{n}^{m}",t:"Subscript and superscript"},{d:"ⁿCᵣ",l:"{}^{n}C_{r}",t:"Combination"},
  ]},
  { icon:"αΩ", label:"Greek Letters", items:[
    {d:"α",l:"\\alpha",t:"alpha"},{d:"β",l:"\\beta",t:"beta"},{d:"γ",l:"\\gamma",t:"gamma"},
    {d:"Δ",l:"\\Delta",t:"Delta"},{d:"θ",l:"\\theta",t:"theta"},{d:"λ",l:"\\lambda",t:"lambda"},
    {d:"μ",l:"\\mu",t:"mu"},{d:"π",l:"\\pi",t:"pi"},{d:"Σ",l:"\\Sigma",t:"Sigma"},
    {d:"φ",l:"\\phi",t:"phi"},{d:"ω",l:"\\omega",t:"omega"},{d:"Ω",l:"\\Omega",t:"Omega"},
    {d:"δ",l:"\\delta",t:"delta"},{d:"ε",l:"\\epsilon",t:"epsilon"},{d:"η",l:"\\eta",t:"eta"},
    {d:"κ",l:"\\kappa",t:"kappa"},{d:"ν",l:"\\nu",t:"nu"},{d:"ρ",l:"\\rho",t:"rho"},
    {d:"τ",l:"\\tau",t:"tau"},{d:"ψ",l:"\\psi",t:"psi"},{d:"Γ",l:"\\Gamma",t:"Gamma"},
    {d:"Λ",l:"\\Lambda",t:"Lambda"},{d:"Φ",l:"\\Phi",t:"Phi"},{d:"Ψ",l:"\\Psi",t:"Psi"},
  ]},
  { icon:"∫", label:"Calculus", items:[
    {d:"∫",l:"\\int_{a}^{b}",t:"Definite integral"},{d:"∂f/∂x",l:"\\frac{\\partial f}{\\partial x}",t:"Partial derivative"},
    {d:"dy/dx",l:"\\frac{dy}{dx}",t:"Derivative"},{d:"lim",l:"\\lim_{x\\to 0}",t:"Limit"},
    {d:"∑",l:"\\sum_{i=0}^{n}",t:"Sum"},{d:"∇",l:"\\nabla",t:"Nabla"},
    {d:"∞",l:"\\infty",t:"Infinity"},{d:"∬",l:"\\iint",t:"Double integral"},
    {d:"∮",l:"\\oint",t:"Contour integral"},{d:"d²y/dx²",l:"\\frac{d^{2}y}{dx^{2}}",t:"2nd derivative"},
    {d:"∫f dx",l:"\\int f\\,dx",t:"Indefinite integral"},{d:"∭",l:"\\iiint",t:"Triple integral"},
    {d:"∂²f/∂x²",l:"\\frac{\\partial^{2} f}{\\partial x^{2}}",t:"Second partial derivative"},
    {d:"f′",l:"f'",t:"First derivative prime"},{d:"f″",l:"f''",t:"Second derivative prime"},
    {d:"lim∞",l:"\\lim_{x\\to\\infty}",t:"Limit to infinity"},{d:"∏",l:"\\prod_{i=1}^{n}",t:"Product"},
    {d:"∇·F",l:"\\nabla\\cdot F",t:"Divergence"},{d:"∇×F",l:"\\nabla\\times F",t:"Curl"},
    {d:"dx",l:"\\,dx",t:"Differential dx"},
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
    {d:"→v",l:"\\vec{v}",t:"Vector"},{d:"u·v",l:"u\\cdot v",t:"Dot product"},
    {d:"u×v",l:"u\\times v",t:"Cross product"},{d:"‖v‖",l:"\\left|\\left|v\\right|\\right|",t:"Norm"},
    {d:"2×2",l:buildMatrixLatex(2,2,"bmatrix"),t:"2 by 2 matrix"},
    {d:"2×1",l:"\\begin{bmatrix}x\\\\y\\end{bmatrix}",t:"2D column vector"},
    {d:"3×1",l:"\\begin{bmatrix}x\\\\y\\\\z\\end{bmatrix}",t:"3D column vector"},
    {d:"I₂",l:"\\begin{bmatrix}1&0\\\\0&1\\end{bmatrix}",t:"2 by 2 identity matrix"},
    {d:"Aᵀ",l:"A^{T}",t:"Transpose"},
  ]},
];

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

const QUICK_MATH = [
  {d:"a/b",l:"\\frac{a}{b}"},{d:"√x",l:"\\sqrt{x}"},{d:"x²",l:"x^{2}"},
  {d:"±",l:"\\pm"},{d:"≤",l:"\\leq"},{d:"≥",l:"\\geq"},
  {d:"≠",l:"\\neq"},{d:"≈",l:"\\approx"},{d:"∞",l:"\\infty"},
  {d:"π",l:"\\pi"},{d:"∑",l:"\\sum"},{d:"∫",l:"\\int"},
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
  "0123456789²³¹¼½¾٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹๐๑๒๓๔๕๖๗๘๙⁰⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞①②③④⑤⑥⑦⑧⑨⓪➀➁➂➃➄➅➆➇➈➉➊➋➌➍➎➏➐➑➒➓𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿"
);

const PHONETICAL_CHARACTER_CHARS = Array.from(String.raw`pbtdʈɖcɟkɡqɢʔmɱnɳɲŋɴrʀɾɽɸβfvθðszʃʒʂʐçʝxɣχʁħʕhɦɬɮʋɹɻjɰlɭʎʟƥɓƭɗƈʄƙɠʠʛʍwɥʜʡʢɧʘǀǃǂǁɺɕʑⱱʇʗʖʆʓɼˢƫɫgʦʣʧʤʨʥᶿᵊᶑƻʞˣƞƛλžšǰčieɛaɑɔouyøœɶɒʌɤɯɨʉɪʏʊəɵɐæɜɚıɞʚɘɷɩʼ̥̬̊ʰ̤̰̼̪̺̻̹̜̟̠̘̙̈̽˞ʷʲˠˤ̃ⁿˡ̴̝̚˔̞˕̢̩̯͜͡˹,ʻ̇˗˖ʸ̡̣̫ˈˌːˑ̆.|‖‿↗↘̋́̄̀̏ꜛꜜ˥˦˧˨˩̌̂᷄᷅᷈̑ˇˆ̖ˎ̗ˏʭʩʪʫ❍*VFWCLJŒΘ𝆑𝆏123͍͈͉͆͊͋͌\͎↓↑ˬᶹ͇͢ʶ˭˱˲˷ABDEGHIKMNOPQRSTUVWXYZ[]/(){}`);

const SPECIAL_CHARACTER_GROUPS = {
  symbol: { label: "Symbol", chars: SPECIAL_CHARACTER_CHARS },
  punctuation: { label: "Punctuation", chars: PUNCTUATION_CHARACTER_CHARS },
  letter: { label: "Letter", chars: LETTER_CHARACTER_CHARS },
  mark: { label: "Mark", chars: MARK_CHARACTER_CHARS },
  number: { label: "Number", chars: NUMBER_CHARACTER_CHARS },
  phonetical: { label: "Phonetical", chars: PHONETICAL_CHARACTER_CHARS },
};

const characterCode = (char) =>
  `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;

const charFromCode = (value) => {
  const hex = String(value).trim().replace(/^U\+/i, "").replace(/[^0-9a-f]/gi, "");
  if (!hex) return "";
  const codePoint = Number.parseInt(hex, 16);
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10FFFF) return "";
  return String.fromCodePoint(codePoint);
};

// ════════════════════════════════════════════════════════════════════════════
// Modal Shell — premium window chrome
// ════════════════════════════════════════════════════════════════════════════
function SymbolBtn({ item, onInsert, theme = "blue" }) {
  const [hov, setHov] = useState(false);

  const isGreen = theme === "green";

  return (
    <button
      type="button"
      title={item.t}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onInsert(item.l)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        minWidth: isGreen ? 50 : 40,
        height: 30,
        padding: "3px 6px",
        background: hov ? (isGreen ? "#f0fdf4" : "#eff6ff") : "#f8fafc",
        border: `1px solid ${hov ? (isGreen ? "#86efac" : "#93c5fd") : "#e2e8f0"}`,
        borderRadius: 7,
        cursor: "pointer",
        fontSize: "1rem",
        fontFamily: "serif",
        color: isGreen ? "#166534" : "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 500,
      }}
    >
      {item.d}
    </button>
  );
}

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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "fixed",
          right: "calc(100% - 100vw)",
          bottom: 0,
          width,
          maxHeight,
          background: "#ffffff",
          borderRadius: 10,
          overflowX: "hidden",
          overflowY: "auto",
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            background: bg,
            padding: "1px 8px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
            userSelect: "none",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.88rem",
              letterSpacing: "0.02em",
            }}
          >
            {title}
          </span>

          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "rgba(255,255,255,0.2)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
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

// ── Small symbol button inside modals ─────────────────────────────────────────
const SB = ({children,onClick,title,active,color="#000",bg="#f8f9fa",activeBg="#dbeafe"}) => {
  const [hov,setHov] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{minWidth:28,height:26,padding:"0 5px",
        background:active?activeBg:hov?"#f0f0f0":bg,
        border:`1px solid ${active?"#93c5fd":hov?"#d0d0d0":"transparent"}`,
        borderRadius:5,cursor:"pointer",fontSize:"0.75rem",fontFamily:"serif",
        display:"flex",alignItems:"center",justifyContent:"center",
        color,flexShrink:0,transition:"all 0.1s",fontWeight:500}}>
      {children}
    </button>
  );
};

const RIBBON_MINI = {
  "Roots & Fractions": "√□",
  "Greek Letters": "α Ω",
  "Calculus": "Σ ∫",
  "Sets & Logic": "∈ ∞",
  "Trigonometry": "sin",
  "Matrices & Vectors": "▦▦",
};

function RibbonSymbolButton({ item, onInsert, onMatrix }) {
  const isMatrix = parseMatrixLatex(item.l);

  return (
    <button
      type="button"
      title={item.t}
      className="math-ribbon-symbol"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => isMatrix ? onMatrix(item.l) : onInsert(item.l)}
    >
      {item.d}
    </button>
  );
}

function MatrixButtonIcon() {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:3}}>
      <span style={{fontSize:"1.1rem",lineHeight:1,color:"#1f7a38"}}>[</span>
      <span style={{display:"grid",gridTemplateColumns:"repeat(2,5px)",gap:2}}>
        {[0,1,2,3].map(i => (
          <span key={i} style={{width:5,height:5,border:"1px solid #1f7a38",background:"#f8fff8"}} />
        ))}
      </span>
      <span style={{fontSize:"1.1rem",lineHeight:1,color:"#1f7a38"}}>]</span>
    </span>
  );
}

function MatrixPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState({ rows: 3, cols: 3 });
  const [env, setEnv] = useState("bmatrix");
  const maxRows = 6;
  const maxCols = 6;

  const envButtons = [
    { env: "bmatrix", label: "[ ]", title: "Square brackets" },
    { env: "pmatrix", label: "( )", title: "Parentheses" },
    { env: "vmatrix", label: "| |", title: "Determinant" },
    { env: "matrix", label: "none", title: "No brackets" },
  ];
  const clamp = (value, max) => Math.min(Math.max(Number(value) || 1, 1), max);
  const pick = (rows = hover.rows, cols = hover.cols) => {
    onPick(buildMatrixLatex(rows, cols, env));
    setOpen(false);
  };

  return (
    <div style={{position:"relative",display:"inline-flex"}}>
      <button
        type="button"
        title="Matrix"
        onMouseDown={(e)=>e.preventDefault()}
        onClick={()=>setOpen(value=>!value)}
        style={{
          minWidth:62,height:30,padding:"2px 8px",
          background:open?"#dbeafe":"#eef6ff",
          border:`1.5px solid ${open?"#2563eb":"#93c5fd"}`,
          borderRadius:7,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:4,
          boxShadow:open?"0 1px 5px rgba(37,99,235,0.25)":"none",
        }}
      >
        <MatrixButtonIcon />
        <span style={{fontSize:"0.7rem",color:"#174ea6",fontWeight:800}}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position:"absolute",top:"calc(100% + 5px)",left:0,zIndex:100,
            width:120,padding:2,background:"#f8fbff",
            border:"1px solid #9fb4c7",borderRadius:7,
            boxShadow:"0 12px 28px rgba(15,23,42,0.2)",
          }}
        >
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:3,marginBottom:6}}>
            {envButtons.map(button => (
              <button
                key={button.env}
                type="button"
                title={button.title}
                onClick={()=>setEnv(button.env)}
                style={{
                  height:20,border:`1px solid ${env===button.env?"#2563eb":"#cbd5e1"}`,
                  borderRadius:5,background:env===button.env?"#dbeafe":"#fff",
                  color:"#0f172a",cursor:"pointer",fontSize:"0.58rem",fontFamily:"serif",
                }}
              >
                {button.label}
              </button>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:`repeat(${maxCols}, 13px)`,gap:2}}>
            {Array.from({ length: maxRows * maxCols }, (_, index) => {
              const row = Math.floor(index / maxCols) + 1;
              const col = (index % maxCols) + 1;
              const active = row <= hover.rows && col <= hover.cols;

              return (
                <button
                  key={index}
                  type="button"
                  title={`${row} rows, ${col} columns`}
                  onMouseEnter={()=>setHover({rows:row,cols:col})}
                  onFocus={()=>setHover({rows:row,cols:col})}
                  onClick={()=>pick(row,col)}
                  style={{
                    width:13,height:13,padding:0,border:`1px solid ${active?"#1f7a38":"#b6c7d8"}`,
                    background:active?"#dff6e6":"#fff",borderRadius:2,cursor:"pointer",
                  }}
                />
              );
            })}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 52px",gap:5,alignItems:"center",marginTop:7}}>
            <label style={{fontSize:"0.72rem",color:"#668296",fontWeight:800}}>Rows:</label>
            <input
              type="number"
              min={1}
              max={maxRows}
              value={hover.rows}
              onChange={e=>setHover(value=>({...value,rows:clamp(e.target.value,maxRows)}))}
              style={{height:22,border:"1px solid #b6c7d8",borderRadius:4,padding:"0 4px",fontSize:"0.75rem"}}
            />
            <label style={{fontSize:"0.72rem",color:"#668296",fontWeight:800}}>Columns:</label>
            <input
              type="number"
              min={1}
              max={maxCols}
              value={hover.cols}
              onChange={e=>setHover(value=>({...value,cols:clamp(e.target.value,maxCols)}))}
              style={{height:22,border:"1px solid #b6c7d8",borderRadius:4,padding:"0 4px",fontSize:"0.75rem"}}
            />
          </div>

          <button
            type="button"
            onClick={()=>pick()}
            style={{
              width:"100%",marginTop:7,height:25,border:"none",borderRadius:5,
              background:"#2563eb",color:"#fff",fontSize:"0.72rem",fontWeight:800,cursor:"pointer",
            }}
          >
            Insert {hover.rows}×{hover.cols}
          </button>
        </div>
      )}
    </div>
  );
}

function SpecialCharacterPicker({ onPick }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("symbol");
  const [selected, setSelected] = useState("$");
  const [code, setCode] = useState(characterCode("$"));
  const activeCharacters = SPECIAL_CHARACTER_GROUPS[category].chars;

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
    <div className="special-symbol-picker">
      <button
        type="button"
        title="Special character"
        className={`math-ribbon-mini rich special-symbol-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen(value => !value)}
      >
        Ω
      </button>

      {open && (
        <div className="special-symbol-panel">
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
        </div>
      )}
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
    <div style={{display:"flex",flexDirection:"column",gap:inCanvas?0:8,width:inCanvas?"fit-content":"100%"}}>
      {!inCanvas && (
        <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          {envButtons.map(button => (
            <button
              key={button.env}
              type="button"
              title={button.title}
              onClick={()=>update(matrix.rows, button.env)}
              style={{
                height:26,padding:"0 8px",
                border:`1px solid ${matrix.env===button.env?"#2563eb":"#cbd5e1"}`,
                borderRadius:5,background:matrix.env===button.env?"#dbeafe":"#fff",
                color:"#0f172a",cursor:"pointer",fontSize:"0.7rem",fontFamily:"serif",
              }}
            >
              {button.label}
            </button>
          ))}

          <span style={{marginLeft:4,fontSize:"0.7rem",color:"#64748b",fontWeight:800}}>Rows</span>
          <input
            type="number"
            min={1}
            max={maxSize}
            value={matrix.rows.length}
            onChange={e=>updateSize(e.target.value, matrix.colCount)}
            style={{width:46,height:25,border:"1px solid #cbd5e1",borderRadius:5,fontSize:"0.72rem",padding:"0 4px"}}
          />

          <span style={{fontSize:"0.7rem",color:"#64748b",fontWeight:800}}>Columns</span>
          <input
            type="number"
            min={1}
            max={maxSize}
            value={matrix.colCount}
            onChange={e=>updateSize(matrix.rows.length, e.target.value)}
            style={{width:46,height:25,border:"1px solid #cbd5e1",borderRadius:5,fontSize:"0.72rem",padding:"0 4px"}}
          />
        </div>
      )}

      <div className={`meq-matrix-wrap meq-matrix-edit-wrap meq-matrix-${matrix.env}`}>
        <div
          className="meq-matrix-edit-grid"
          style={{gridTemplateColumns:`repeat(${matrix.colCount}, ${cellSize}px)`}}
        >
          {matrix.rows.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <input
                key={`${rowIndex}-${colIndex}`}
                value={cell}
                aria-label={`Matrix row ${rowIndex + 1} column ${colIndex + 1}`}
                onChange={e=>updateCell(rowIndex, colIndex, e.target.value)}
                style={{
                  width:inputSize,height:inputSize,border:"1.4px solid #1f7a38",borderRadius:3,
                  background:"#fff",color:"#166534",textAlign:"center",
                  fontFamily:"serif",fontSize:(inCanvas ? fontSize * 0.9 : 14) + "px",outline:"none",
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
  lineRefs, mqRefs, MQ, fontSize=14, minHeight=190, matrixLatex="", setMatrixLatex,
  textDirection="ltr" }) {
  const editingMatrix = Boolean(matrixLatex && setMatrixLatex);
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
      style={{display:"flex",background:"#ffffff",flex:1,overflow:"hidden",minHeight,direction:textDirection}}
    >
      {/* Equation lines */}
      <div style={{
        flex:1,overflowY:"auto",paddingTop:6,paddingBottom:16,cursor:"text",
        direction:textDirection,textAlign:isRtl ? "right" : "left",
      }}>
        {editingMatrix ? (
          <div style={{padding:"14px 18px",minHeight:minHeight - 22,display:"flex",justifyContent:isRtl ? "flex-end" : "flex-start"}}>
            <MatrixEditor latex={matrixLatex} onChange={setMatrixLatex} inCanvas fontSize={fontSize} />
          </div>
        ) : !MQ && (
          <div style={{padding:"16px 20px",color:"#9ca3af",fontStyle:"italic",fontSize:"0.85rem"}}>
            Loading equation editor…
          </div>
        )}
        {!editingMatrix && MQ && lines.map((_,i)=>(
          <div key={i} onClick={()=>setActiveLine(i)}
            style={{display:"flex",alignItems:"center",minHeight:46,
              paddingLeft:isRtl ? 10 : 12,paddingRight:isRtl ? 12 : 10,cursor:"text",position:"relative",
              background:"transparent",
              transition:"all 0.12s",boxSizing:"border-box",direction:textDirection}}>
            <span ref={el=>lineRefs.current[i]=el}
              onKeyDown={e=>handleKey(e,i)}
              style={{
                display:"block",flex:1,fontSize:fontSize+"px",lineHeight:1,minHeight:36,
                direction:textDirection,textAlign:isRtl ? "right" : "left",
              }}/>
          </div>
        ))}
        {/* Empty space to click and add lines */}
        {!editingMatrix && MQ && (
          <div style={{padding:"6px 14px",textAlign:isRtl ? "right" : "left"}}>
            <button type="button"
              onClick={()=>{
                setLines(p=>[...p,""]);
                mqRefs.current.splice(lines.length);
                lineRefs.current.splice(lines.length);
                setActiveLine(lines.length);
              }}
              style={{background:"none",border:"none",cursor:"pointer",
                fontSize:"0.72rem",color:"#9ca3af",padding:"2px 0",
                display:"flex",alignItems:"center",gap:4}}>
              
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
  const [matrixLatex,setMatrixLatex] = useState(initialMatrix);
  const [lines,setLines]           = useState(() => {
    if (initialMatrix) return [""];
    const initialLines = splitEquationLines(initialLatex);
    return initialLines.length ? initialLines : [""];
  });
  const [activeLine,setActiveLine] = useState(0);
  const lineRefs = useRef([]);
  const mqRefs   = useRef([]);
  const [MQ,setMQ] = useState(null);

  useEffect(()=>{
    let c=false;
    loadMQ().then(mq=>{ if(!c) setMQ(()=>mq); });
    return()=>{ c=true; };
  },[]);

  useEffect(()=>{
    if(!MQ) return;
    if(matrixLatex) return;
    lines.forEach((lt,i)=>{
      if(!lineRefs.current[i]||mqRefs.current[i]) return;
      const mq=MQ.MathField(lineRefs.current[i],{
        spaceBehavesLikeTab:false,
        handlers:{edit:f=>setLines(p=>p.map((l,idx)=>idx===i?f.latex():l))},
      });
      mq.latex(lt||""); mqRefs.current[i]=mq;
    });
  },[MQ,lines.length,matrixLatex]);

  useEffect(()=>{
    if(matrixLatex) return;
    setTimeout(()=>mqRefs.current[activeLine]?.focus(),30);
  },[activeLine,lines.length,matrixLatex]);

  const ins = l => {
    if (matrixLatex) {
      setMatrixLatex("");
      setLines([""]);
      mqRefs.current=[];
      lineRefs.current=[];
      setActiveLine(0);
      setTimeout(()=>mqInsert(mqRefs.current[0], l),60);
      return;
    }
    setMatrixLatex("");
    mqInsert(mqRefs.current[activeLine], l);
  };
  const insertSpecialChar = char => {
    if (matrixLatex) {
      setMatrixLatex("");
      setLines([""]);
      mqRefs.current=[];
      lineRefs.current=[];
      setActiveLine(0);
      setTimeout(()=>mqInsertPlainText(mqRefs.current[0], char),60);
      return;
    }
    setMatrixLatex("");
    mqInsertPlainText(mqRefs.current[activeLine], char);
  };
  const chooseMatrix = l => {
    setMatrixLatex(l);
    setLines([""]);
    mqRefs.current=[];
    lineRefs.current=[];
    setActiveLine(0);
  };
  const clr = () => { setMatrixLatex(""); setLines([""]); mqRefs.current=[]; lineRefs.current=[]; setActiveLine(0); };
  const toggleEditorDirection = () => {
    setEditorDirection(d => d === "rtl" ? "ltr" : "rtl");
    setTimeout(()=>mqRefs.current[activeLine]?.focus(),30);
  };
  const full = matrixLatex || lines.join(" \\\\ ");
  const has  = matrixLatex.trim()!=="" || lines.some(l=>l.trim()!=="");
  const isMatrixGroup = MATH_GROUPS[grp].label === "Matrices & Vectors";

  return (
    <ModalShell
      title="√ MathType — Equation Editor"
      accent="blue"
      onClose={onClose}
      width="min(500px, 100vw)"
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
          <div className="math-ribbon-palette">
            {isMatrixGroup && <MatrixPicker onPick={chooseMatrix} />}
            {MATH_GROUPS[grp].items.map((it) => (
              <RibbonSymbolButton key={`${it.t}-${it.l}`} item={it} onInsert={ins} onMatrix={chooseMatrix} />
            ))}
          </div>

          <div className="math-ribbon-sep" />

          <div className="math-ribbon-quick">
            {QUICK_MATH.map((b,i)=>(
              <button
                key={`${b.d}-${i}`}
                type="button"
                title={b.d}
                className="math-ribbon-mini"
                onClick={()=>ins(b.l)}
              >
                {b.d}
              </button>
            ))}
            <button type="button" title="Bold math" className="math-ribbon-mini rich" onClick={()=>ins("\\mathbf{}")}>
              <b>B</b>
            </button>
            <button type="button" title="Italic math" className="math-ribbon-mini rich" onClick={()=>ins("\\mathit{}")}>
              <i>1b</i>
            </button>
            <button type="button" title="Blackboard" className="math-ribbon-mini rich" onClick={()=>ins("\\mathbb{}")}>
              T
            </button>
            <SpecialCharacterPicker onPick={insertSpecialChar} />
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

          <button
            type="button"
            title={matrixLatex ? "Clear matrix" : "Delete last"}
            className="math-ribbon-backspace"
            onClick={()=>matrixLatex ? setMatrixLatex("") : mqRefs.current[activeLine]?.keystroke("Backspace")}
          >
            {matrixLatex ? "Clear matrix" : "↩"}
          </button>
        </div>
      </div>

      {/* Equation editing area */}
      <EquationArea accent="blue" lines={lines} setLines={setLines}
        activeLine={activeLine} setActiveLine={setActiveLine}
        lineRefs={lineRefs} mqRefs={mqRefs} MQ={MQ} fontSize={size} minHeight={160}
        matrixLatex={matrixLatex} setMatrixLatex={setMatrixLatex}
        textDirection={editorDirection} />

      {/* Bottom status + actions */}
      <div style={{padding:"8px 14px",display:"flex",alignItems:"center",gap:10,
        background:"#f8fafc",borderTop:"1px solid #e2e8f0",flexShrink:0}}>
       
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          <button type="button" onClick={onClose}
            style={{padding:"7px 18px",background:"#fff",border:"1.5px solid #e2e8f0",
              borderRadius:7,cursor:"pointer",fontSize:"0.82rem",fontWeight:600,color:"#6b7280",
              transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.background="#f8fafc";}}
            onMouseLeave={e=>{e.currentTarget.style.background="#fff";}}>
            Cancel
          </button>
          <button type="button" onClick={()=>has&&onInsert(full)} disabled={!has}
            style={{padding:"7px 22px",
              background:has?"linear-gradient(135deg,#3b82f6,#1d4ed8)":"#e5e7eb",
              border:"none",borderRadius:7,cursor:has?"pointer":"not-allowed",
              fontSize:"0.82rem",fontWeight:700,color:has?"#fff":"#9ca3af",
              boxShadow:has?"0 2px 8px rgba(37,99,235,0.4)":"none",
              transition:"all 0.15s"}}>
            {submitLabel}
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

  const ins = l => mqInsert(mqRefs.current[activeLine], l);
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
      <div style={{display:"flex",gap:3,padding:"8px 10px",
        background:"#f8fafc",borderBottom:"1px solid #e2e8f0",flexWrap:"wrap",flexShrink:0}}>
        {CHEM_GROUPS[grp].items.map((it, i) => (
  <button
    key={i}
    type="button"
    title={it.t}
    onMouseDown={(e) => e.preventDefault()}
    onClick={() => ins(it.l)}
    style={{
      minWidth: 50,
      height: 40,
      padding: "3px 8px",
      background: "#f8fafc",
      border: "1.5px solid #e2e8f0",
      borderRadius: 7,
      cursor: "pointer",
      fontSize: "0.78rem",
      fontFamily: "serif",
      color: "#166534",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 500,
    }}
  >
    {it.d}
  </button>
))}
        <button type="button" onClick={clr}
          style={{marginLeft:"auto",padding:"5px 12px",background:"#fee2e2",
            border:"1.5px solid #fca5a5",borderRadius:6,color:"#dc2626",
            cursor:"pointer",fontSize:"0.75rem",fontWeight:700}}>🗑 Clear</button>
      </div>

      {/* Compound palette */}
    

      {/* Quick chem operators */}
      <div style={{display:"flex",gap:3,padding:"6px 10px",background:"#f8fafc",
        borderBottom:"1px solid #e2e8f0",flexWrap:"wrap",alignItems:"center",flexShrink:0}}>
        {[
          {d:"→",l:"\\rightarrow"},{d:"⇌",l:"\\rightleftharpoons"},
          {d:"↑",l:"\\uparrow"},{d:"↓",l:"\\downarrow"},
          {d:"+",l:"+"},{d:"·",l:"\\cdot"},
          {d:"⁺",l:"^{+}"},{d:"⁻",l:"^{-}"},
          {d:"²⁺",l:"^{2+}"},{d:"²⁻",l:"^{2-}"},
          {d:"Δ",l:"\\Delta"},{d:"°",l:"^{\\circ}"},
        ].map((b,i)=>(
          <SB key={i} title={b.d} onClick={()=>ins(b.l)} color="#166534" bg="#f0fdf4">{b.d}</SB>
        ))}
        <button type="button" title="Delete last" onClick={()=>mqRefs.current[activeLine]?.keystroke("Backspace")}
          style={{marginLeft:"auto",padding:"4px 10px",background:"#fff3f3",
            border:"1.5px solid #fca5a5",borderRadius:5,cursor:"pointer",
            color:"#e80000",fontSize:"0.75rem",fontWeight:700}}>↩ Backspace</button>
      </div>

      <EquationArea accent="green" lines={lines} setLines={setLines}
        activeLine={activeLine} setActiveLine={setActiveLine}
        lineRefs={lineRefs} mqRefs={mqRefs} MQ={MQ} fontSize={15} minHeight={160} />

      <div style={{padding:"8px 14px",display:"flex",alignItems:"center",gap:10,
        background:"#f8fafc",borderTop:"1px solid #e2e8f0",flexShrink:0}}>
        <span style={{fontSize:"0.65rem",color:"#010a19",display:"flex",alignItems:"center",gap:6}}>
         
          
        </span>
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}>
          <button type="button" onClick={onClose}
            style={{padding:"7px 18px",background:"#fff",border:"1.5px solid #e2e8f0",
              borderRadius:7,cursor:"pointer",fontSize:"0.82rem",fontWeight:600,color:"#525866"}}>
            Cancel
          </button>
          <button type="button" onClick={()=>has&&onInsert(full)} disabled={!has}
            style={{padding:"7px 22px",
              background:has?"linear-gradient(135deg,#22c55e,#15803d)":"#e5e7eb",
              border:"none",borderRadius:7,cursor:has?"pointer":"not-allowed",
              fontSize:"0.82rem",fontWeight:700,color:has?"#fff":"#9ca3af",
              boxShadow:has?"0 2px 8px rgba(22,163,74,0.4)":"none",transition:"all 0.15s"}}>
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
  const [hov, setHov] = useState(false);
  const [tip, setTip] = useState(false);
  const ref = useRef(null);
  const [tipPos, setTipPos] = useState({left:0});

  const showTip = () => {
    setTip(true);
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setTipPos({ left: r.width/2 });
    }
  };

  let bg = "transparent", border = "transparent", color = "#374151", shadow = "none";
  if (disabled) { color="#d1d5db"; }
  else if (special==="math") {
    bg = hov||active ? "#1d4ed8" : "#2563eb";
    border = hov ? "#1e40af" : "#2563eb";
    color = "#fff";
    shadow = "0 1px 4px rgba(37,99,235,0.4)";
  } else if (special==="chem") {
    bg = hov||active ? "#15803d" : "#16a34a";
    border = hov ? "#166534" : "#16a34a";
    color = "#fff";
    shadow = "0 1px 4px rgba(22,163,74,0.4)";
  } else if (active) {
    bg="#dbeafe"; border="#93c5fd"; color="#1d4ed8";
  } else if (hov) {
    bg="#f1f5f9"; border="#cbd5e1"; color="#1e293b";
  }

  return (
    <div style={{position:"relative",display:"inline-flex",flexShrink:0}} ref={ref}>
      <button type="button" onClick={disabled?undefined:onClick}
        title={undefined}
        onMouseEnter={()=>{ if(!disabled){setHov(true); showTip();} }}
        onMouseLeave={()=>{ setHov(false); setTip(false); }}
        style={{
          height:30, minWidth:wide?60:30, padding:wide?"0 10px":"0 6px",
          background:bg, border:`1.5px solid ${border}`,
          borderRadius:6, cursor:disabled?"not-allowed":"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:4,
          color, fontSize:"0.8rem", fontWeight:500,
          boxShadow:shadow, transition:"all 0.12s",
          opacity:disabled?0.45:1,
        }}>
        {children}
      </button>
      {/* Tooltip */}
      {tip && title && (
        <div style={{
          position:"absolute",top:"calc(100% + 6px)",
          left:"50%",transform:"translateX(-50%)",
          background:"#1e293b",color:"#fff",
          fontSize:"0.65rem",fontWeight:500,
          padding:"3px 8px",borderRadius:5,
          whiteSpace:"nowrap",pointerEvents:"none",
          zIndex:1000,boxShadow:"0 2px 8px rgba(0,0,0,0.3)",
        }}>
          {title}
          <div style={{position:"absolute",top:-4,left:"50%",transform:"translateX(-50%)",
            width:0,height:0,borderLeft:"4px solid transparent",
            borderRight:"4px solid transparent",borderBottom:"4px solid #1e293b"}}/>
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <div style={{width:1,height:22,background:"#e2e8f0",margin:"0 2px",flexShrink:0}}/>;
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
    span.style.cssText=`
  display:inline-flex;
  align-items:center;
  width:auto;
  max-width:100%;
  margin:0 4px;
  padding:3px 7px;
   background-color: transparent;
  border:1.5px solid transparent;
  border-radius:6px;
  cursor:pointer;
  user-select:none;
  font-size:1rem;
  line-height:1.4;
  vertical-align:middle;
  color:#000;
`;
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
      style={{padding:"10px 14px",background:"var(--bg-elevated)",
        border:"1px solid var(--border)",borderRadius:"var(--radius-md)",
        fontSize:"0.95rem",lineHeight:1.8,color:"var(--text-primary)",minHeight:40}}/>
    );
  }

  return(
    <div style={{
      display:"flex",flexDirection:"column",
      border:`1.5px solid ${focused?"#93c5fd":"#e2e8f0"}`,
      borderRadius:10,overflow:"hidden",background:"#fff",
      boxShadow:focused?"0 0 0 3px rgba(147,197,253,0.3)":"0 1px 4px rgba(0,0,0,0.06)",
      transition:"all 0.2s",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    }}>

      {/* ═══ PREMIUM TOOLBAR ═══ */}
      <div style={{
        display:"flex",alignItems:"center",gap:3,padding:"6px 10px",
        background:"linear-gradient(180deg,#f8fafc,#f1f5f9)",
        borderBottom:"1px solid #e2e8f0",flexWrap:"wrap",
        boxShadow:"0 1px 3px rgba(0,0,0,0.04)",
      }}>

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
          style={{height:30,fontSize:"0.72rem",padding:"0 6px",
            border:"1.5px solid #e2e8f0",borderRadius:6,
            background:"#fff",cursor:"pointer",color:"#374151",
            boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
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
          <span style={{fontSize:"0.72rem",fontWeight:800,lineHeight:1}}>RTL</span>
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
        <div style={{position:"relative",display:"inline-flex"}} title="Text Color">
          <label style={{height:30,width:30,border:"1.5px solid #e2e8f0",
            borderRadius:6,cursor:"pointer",overflow:"hidden",display:"flex",
            alignItems:"center",justifyContent:"center",background:"#fff",
            boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}
            title="Text color">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
              <path d="M9 3L5 21M15 3l4 18M5 12h14"/>
            </svg>
            <input type="color" onChange={e=>exec("foreColor",e.target.value)}
              style={{position:"absolute",opacity:0,width:"100%",height:"100%",cursor:"pointer"}}/>
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
          <span style={{fontSize:"1rem",fontFamily:"Georgia,serif",lineHeight:1}}>√</span>
          <span style={{fontSize:"0.75rem",fontWeight:700,letterSpacing:"0.02em"}}>Math</span>
        </TBtn>

        {/* ── CHEM button ── */}
        <TBtn title="Insert Chemistry Equation" special="chem" wide
          onClick={()=>{ saveSelection(); setEditTarget(null); setModal("chem"); }}>
          <span style={{fontSize:"0.9rem"}}>⚗</span>
          <span style={{fontSize:"0.75rem",fontWeight:700,letterSpacing:"0.02em"}}>Chem</span>
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
        style={{
          minHeight:180,whiteSpace:"pre-wrap",wordBreak:"break-word",padding:"14px 16px",
          fontSize:"0.95rem",color:"#1e293b",lineHeight:1.85,
          outline:"none",overflowY:"auto",
          direction:textDirection,
          textAlign:textDirection==="rtl" ? "right" : "left",
          fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          background:"#fff",
        }}
      />

      {/* Placeholder */}
      {!value && (
        <div style={{position:"absolute",pointerEvents:"none",padding:"14px 16px",
          color:"#9ca3af",fontStyle:"italic",fontSize:"0.95rem"}}>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"4px 12px",background:"#f8fafc",
        borderTop:"1px solid #e2e8f0",
      }}>
        <div style={{display:"flex",gap:10}}>
         
           
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

      <style>{`
        [contenteditable]:empty:before {
          content:"${placeholder}";
          color:#9ca3af;font-style:italic;pointer-events:none;
        }
        .meq .mq-root-block { padding:0!important; min-width:0!important; }
        .meq { vertical-align:middle; }
      `}</style>
    </div>
  );
}
