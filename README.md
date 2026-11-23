# Eidos English · lesson boards

Online lesson boards for Eidos English. Open `admin.html` to create a lesson and get its two links:
one for the teacher, one for the student. Teachers and students draw and write on top of the board;
everything is saved for the lesson, and students can follow the teacher live.

- `index.html`, `app.js`, `base.css`: the board
- `units/`: lesson content and pictures
- `fb.js`, `config.js`: connection to Firebase (Firestore + Authentication)
- `firestore.rules`: access rules (set the owner's address before pasting them into Firebase)
