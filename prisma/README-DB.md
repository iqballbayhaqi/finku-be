# Database – Jangan reset DB

## Perubahan schema (tambah/ubah model/tabel)

- **Pakai:** `yarn db:migrate` (atau `npx prisma migrate dev`)
  - Membuat migration baru dari perubahan di `schema.prisma`
  - **Hanya apply migration**, data tetap aman (tidak reset/hapus)

## Yang TIDAK boleh dipakai saat development (akan menghapus semua data)

- `prisma migrate reset` — menghapus DB dan menjalankan ulang semua migration
- `prisma db push --force-reset` — mendorong schema dengan reset (hapus data)

## Ringkasan

| Perintah              | Efek pada data |
|-----------------------|----------------|
| `yarn db:migrate`     | Aman – hanya apply migration baru |
| `prisma migrate reset`| **Hapus semua data** – hindari |
