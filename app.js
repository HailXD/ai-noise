const MAX_DIM = 1400;
const SAMPLE_PATH = "4c598cf7-ce48-4897-b4ba-24e69dae7c87.png";
const THRESHOLD_MAX = 8;
const GAIN = 1.4;
const GAMMA = 0.35;

const FILE_INPUT = document.getElementById("fileInput");
const SAMPLE_BTN = document.getElementById("sampleBtn");
const SENSITIVITY_INPUT = document.getElementById("sensitivity");
const SENSITIVITY_VALUE = document.getElementById("sensitivityValue");
const ORIGINAL_CANVAS = document.getElementById("originalCanvas");
const NOISE_CANVAS = document.getElementById("noiseCanvas");
const STATUS = document.getElementById("status");

const ORIGINAL_CTX = ORIGINAL_CANVAS.getContext("2d", { willReadFrequently: true });
const NOISE_CTX = NOISE_CANVAS.getContext("2d");

let width = 0;
let height = 0;
let noiseValues = null;

const setStatus = (text) => {
  STATUS.textContent = text;
};

const handleFile = () => {
  const file = FILE_INPUT.files[0];
  if (!file) {
    return;
  }
  loadFromFile(file);
};

const handleSample = () => {
  loadFromPath(SAMPLE_PATH, "sample");
};

const handleSensitivity = () => {
  SENSITIVITY_VALUE.textContent = SENSITIVITY_INPUT.value;
  drawNoise();
};

FILE_INPUT.addEventListener("change", handleFile);
SAMPLE_BTN.addEventListener("click", handleSample);
SENSITIVITY_INPUT.addEventListener("input", handleSensitivity);

window.addEventListener("dragover", (event) => {
  event.preventDefault();
  document.body.classList.add("dragging");
});

window.addEventListener("dragleave", (event) => {
  if (event.target === document.documentElement || event.target === document.body) {
    document.body.classList.remove("dragging");
  }
});

window.addEventListener("drop", (event) => {
  event.preventDefault();
  document.body.classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (file) {
    loadFromFile(file);
  }
});

const loadFromFile = async (file) => {
  const url = URL.createObjectURL(file);
  try {
    await loadImage(url, file.name);
  } finally {
    URL.revokeObjectURL(url);
  }
};

const loadFromPath = async (path, label) => {
  try {
    await loadImage(path, label);
  } catch (error) {
    setStatus("Sample not found. Use Upload image.");
  }
};

const loadImage = (src, label) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    renderImage(img, label);
    resolve();
  };
  img.onerror = reject;
  img.src = src;
});

const renderImage = (img, label) => {
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  width = Math.max(1, Math.floor(img.width * scale));
  height = Math.max(1, Math.floor(img.height * scale));
  ORIGINAL_CANVAS.width = width;
  ORIGINAL_CANVAS.height = height;
  NOISE_CANVAS.width = width;
  NOISE_CANVAS.height = height;
  ORIGINAL_CTX.clearRect(0, 0, width, height);
  ORIGINAL_CTX.drawImage(img, 0, 0, width, height);
  const imageData = ORIGINAL_CTX.getImageData(0, 0, width, height);
  setStatus("Processing noise map...");
  noiseValues = computeNoise(imageData.data, width, height);
  drawNoise();
  const labelText = label ? `Loaded ${label}` : "Loaded image";
  setStatus(`${labelText} (${width} x ${height})`);
};

const computeNoise = (data, w, h) => {
  const stride = w * 4;
  const values = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - 1);
    const y1 = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let count = 0;
      for (let yy = y0; yy <= y1; yy += 1) {
        const row = yy * stride;
        for (let xx = x0; xx <= x1; xx += 1) {
          if (yy === y && xx === x) {
            continue;
          }
          const idx = row + (xx * 4);
          sumR += data[idx];
          sumG += data[idx + 1];
          sumB += data[idx + 2];
          count += 1;
        }
      }
      const idx = (y * stride) + (x * 4);
      const avgR = count > 0 ? sumR / count : data[idx];
      const avgG = count > 0 ? sumG / count : data[idx + 1];
      const avgB = count > 0 ? sumB / count : data[idx + 2];
      const diffR = Math.abs(data[idx] - avgR);
      const diffG = Math.abs(data[idx + 1] - avgG);
      const diffB = Math.abs(data[idx + 2] - avgB);
      values[(y * w) + x] = Math.max(diffR, diffG, diffB);
    }
  }
  return values;
};

const drawNoise = () => {
  if (!noiseValues || width === 0 || height === 0) {
    return;
  }
  const sensitivity = Number(SENSITIVITY_INPUT.value);
  SENSITIVITY_VALUE.textContent = sensitivity;
  const threshold = THRESHOLD_MAX * (1 - (sensitivity / 100));
  const output = NOISE_CTX.createImageData(width, height);
  const outData = output.data;
  for (let i = 0; i < noiseValues.length; i += 1) {
    let v = noiseValues[i] - threshold;
    if (v < 0) {
      v = 0;
    }
    const normalized = v / 255;
    const boosted = Math.pow(normalized, GAMMA);
    v = Math.min(255, boosted * 255 * GAIN);
    const idx = i * 4;
    outData[idx] = v;
    outData[idx + 1] = v;
    outData[idx + 2] = v;
    outData[idx + 3] = 255;
  }
  NOISE_CTX.putImageData(output, 0, 0);
};
