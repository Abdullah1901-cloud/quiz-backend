// hash-password.js

import argon2 from 'argon2';

// Fungsi utama
const hashPassword = async () => {
  const plainPassword = process.argv[2]; // Ambil password dari argumen CLI

  if (!plainPassword) {
    console.error('❌ Masukkan password sebagai argumen.');
    console.error('Contoh: node hash-password.js mySecretPassword');
    process.exit(1);
  }

  try {
    const hashed = await argon2.hash(plainPassword);
    console.log('✅ Password berhasil di-hash:');
    console.log(hashed);
  } catch (err) {
    console.error('❌ Gagal meng-hash password:', err.message);
  }
};

hashPassword();
