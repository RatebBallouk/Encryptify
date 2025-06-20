// Theme toggle logic
const themeToggle = document.getElementById("themeToggle");
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "dark" ? "🌙" : "☀️";
themeToggle.addEventListener("click", () => {
  const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  themeToggle.textContent = newTheme === "dark" ? "🌙" : "☀️";
});

const selectFileBtn = document.getElementById('selectFileBtn');
const fileInput = document.getElementById('fileInput');
const selectedFileName = document.getElementById('selectedFileName');
const dropZone = document.getElementById('dropZone');
const passwordInput = document.getElementById('password');
const encryptBtn = document.getElementById('encryptBtn');
const decryptBtn = document.getElementById('decryptBtn');
const logArea = document.getElementById('log');
const previewArea = document.getElementById('preview');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const copyBtn = document.getElementById('copyBtn');
const passwordStrengthBar = document.getElementById('passwordStrengthBar');
const passwordStrengthText = document.getElementById('passwordStrengthText');

let currentFiles = [];
let currentName = "";

selectFileBtn.addEventListener('click', () => {
  fileInput.value = null;
  fileInput.click();
});

fileInput.addEventListener('change', e => {
  if (e.target.files.length) {
    currentFiles = Array.from(e.target.files);
    currentName = currentFiles.length === 1 ? currentFiles[0].name : `${currentFiles.length} files selected`;
    updateUI();
  }
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    currentFiles = Array.from(e.dataTransfer.files);
    currentName = currentFiles.length === 1 ? currentFiles[0].name : `${currentFiles.length} files selected`;
    updateUI();
  }
});

function updateUI() {
  selectedFileName.textContent = currentName || "No files chosen";
  previewFiles(currentFiles);
  log(`Selected ${currentFiles.length} file(s).`);
  updateProgress(0);
  updatePasswordStrength(passwordInput.value);
}

function log(msg) {
  logArea.value += msg + "\n";
  logArea.scrollTop = logArea.scrollHeight;
}

function previewFiles(files) {
  if (!files.length) {
    previewArea.textContent = "";
    return;
  }
  const maxPreviewFiles = 3;
  const filesToPreview = files.slice(0, maxPreviewFiles);
  let readPromises = filesToPreview.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        let text = "";
        if (file.type.startsWith("text") || file.name.match(/\.(txt|json|md|csv)$/i)) {
          text = reader.result.slice(0, 500);
        } else {
          const bytes = new Uint8Array(reader.result.slice(0, 100));
          text = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
        }
        resolve(`${file.name} (${file.size} bytes):\n${text}\n---`);
      };
      reader.onerror = () => resolve(`${file.name} - Unable to preview\n---`);
      if (file.type.startsWith("text") || file.name.match(/\.(txt|json|md|csv)$/i)) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  });
  Promise.all(readPromises).then(results => {
    previewArea.textContent = results.join("\n");
  });
}

function updateProgress(percent) {
  progressBar.style.width = percent + '%';
  progressText.textContent = percent + '%';
}

// Password strength meter logic
function updatePasswordStrength(password) {
  let strength = 0;
  if (!password) {
    passwordStrengthBar.style.width = '0%';
    passwordStrengthBar.style.backgroundColor = '#555';
    passwordStrengthText.textContent = 'Strength: N/A';
    return;
  }
  if (password.length >= 8) strength += 1;
  if (password.match(/[a-z]/)) strength += 1;
  if (password.match(/[A-Z]/)) strength += 1;
  if (password.match(/[0-9]/)) strength += 1;
  if (password.match(/[^A-Za-z0-9]/)) strength += 1;

  const percent = (strength / 5) * 100;
  passwordStrengthBar.style.width = percent + '%';

  let color = '#f44336'; // red
  let label = 'Weak';
  if (strength === 5) {
    color = '#4caf50'; // green
    label = 'Very Strong';
  } else if (strength >= 3) {
    color = '#ff9800'; // orange
    label = 'Moderate';
  } else if (strength >= 1) {
    color = '#f44336'; // red
    label = 'Weak';
  }
  passwordStrengthBar.style.backgroundColor = color;
  passwordStrengthText.textContent = `Strength: ${label}`;
}

// Hashing helper for SHA-512 checksum (returns Uint8Array)
async function sha512Hash(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-512', buffer);
  return new Uint8Array(hashBuffer);
}

async function getKeyMaterial(password) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
}

async function deriveKey(keyMaterial, salt) {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-512'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

async function zipFiles(files, onProgress) {
  onProgress(10);
  const zip = new JSZip();
  files.forEach(file => {
    zip.file(file.name, file);
  });
  onProgress(50);
  const content = await zip.generateAsync({ type: "uint8array" }, (metadata) => {
    if (metadata.percent) {
      onProgress(10 + metadata.percent * 0.4); // 10% to 50%
    }
  });
  onProgress(60);
  return content.buffer;
}

async function encryptData(dataBuffer, password, onProgress) {
  onProgress(10);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial, salt);

  onProgress(50);
  // Compress data before encryption
  const compressed = pako.deflate(new Uint8Array(dataBuffer));

  onProgress(70);
  // Compute checksum of compressed data
  const checksum = await sha512Hash(compressed.buffer);

  onProgress(80);
  // Encrypt compressed data
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    compressed
  );

  onProgress(90);
  // Construct output: salt(16) + iv(12) + encrypted + checksum(64)
  const encryptedBytes = new Uint8Array(encrypted);
  const output = new Uint8Array(16 + 12 + encryptedBytes.length + 64);
  output.set(salt, 0);
  output.set(iv, 16);
  output.set(encryptedBytes, 28);
  output.set(checksum, 28 + encryptedBytes.length);
  onProgress(100);
  return output.buffer;
}

async function decryptData(dataBuffer, password, onProgress) {
  onProgress(10);
  if (dataBuffer.byteLength < 16 + 12 + 64) {
    throw new Error('File too short or corrupted');
  }
  const data = new Uint8Array(dataBuffer);
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const checksumStored = data.slice(data.length - 64);
  const encryptedData = data.slice(28, data.length - 64);

  const keyMaterial = await getKeyMaterial(password);
  const key = await deriveKey(keyMaterial, salt);

  onProgress(50);
  // Decrypt
  let decrypted;
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
  } catch {
    throw new Error("Decryption failed: wrong password or corrupted data");
  }

  onProgress(80);
  // Verify checksum
  const checksumCalc = await sha512Hash(decrypted);
  for (let i = 0; i < 64; i++) {
    if (checksumCalc[i] !== checksumStored[i]) {
      throw new Error("Checksum mismatch: data corrupted or tampered");
    }
  }

  onProgress(90);
  // Decompress
  const decompressed = pako.inflate(new Uint8Array(decrypted));
  onProgress(100);
  return decompressed.buffer;
}

encryptBtn.addEventListener('click', async () => {
  if (!currentFiles.length) {
    alert("Please select at least one file to encrypt.");
    return;
  }
  if (!passwordInput.value) {
    alert("Please enter a password.");
    return;
  }
  try {
    log("Zipping files...");
    const zipBuffer = await zipFiles(currentFiles, updateProgress);
    log("Encrypting...");
    const encryptedBuffer = await encryptData(zipBuffer, passwordInput.value, updateProgress);

    const blob = new Blob([encryptedBuffer], { type: "application/octet-stream" });
    const fileName = (currentFiles.length === 1 ? currentFiles[0].name : "files") + ".enc";

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);

    log("Encryption complete.");
    updateProgress(0);
  } catch (e) {
    log("Error: " + e.message);
    alert("Encryption failed: " + e.message);
    updateProgress(0);
  }
});

decryptBtn.addEventListener('click', async () => {
  if (!currentFiles.length) {
    alert("Please select one encrypted file to decrypt.");
    return;
  }
  if (currentFiles.length > 1) {
    alert("Please select only one encrypted file to decrypt.");
    return;
  }
  if (!passwordInput.value) {
    alert("Please enter the password.");
    return;
  }
  try {
    const file = currentFiles[0];
    const arrayBuffer = await file.arrayBuffer();
    log("Decrypting...");
    const decryptedBuffer = await decryptData(arrayBuffer, passwordInput.value, updateProgress);

    // Load decrypted ZIP
    const zip = await JSZip.loadAsync(decryptedBuffer);
    log(`Decrypted archive contains ${Object.keys(zip.files).length} file(s).`);

    previewArea.textContent = "";
    for (const filename of Object.keys(zip.files)) {
      const fileData = await zip.files[filename].async('blob');
      const url = URL.createObjectURL(fileData);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.textContent = `Download ${filename}`;
      link.style.display = 'block';
      previewArea.appendChild(link);
    }
    log("Decrypted files ready for download.");
    updateProgress(100);
  } catch (e) {
    log("Error: " + e.message);
    alert("Decryption failed: " + e.message);
    updateProgress(0);
  }
});

copyBtn.addEventListener('click', () => {
  logArea.select();
  document.execCommand('copy');
  log('Log copied to clipboard.');
});

passwordInput.addEventListener('input', e => {
  updatePasswordStrength(e.target.value);
});
