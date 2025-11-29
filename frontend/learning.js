const newNoteBtn = document.getElementById("new-note-btn");
const saveBtn = document.getElementById("save-note-btn");
const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentArea = document.getElementById("note-content");
const searchInput = document.getElementById("search-notes"); // New search ref

let currentNote = null;

// Load saved notes on start
window.addEventListener("DOMContentLoaded", loadNotes);

function loadNotes() {
  const notes = JSON.parse(localStorage.getItem("learningNotes")) || [];
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
  
  notesList.innerHTML = "";

  const filteredNotes = notes.filter(note => 
    (note.title || "").toLowerCase().includes(searchTerm) || 
    (note.content || "").toLowerCase().includes(searchTerm)
  );

  if (filteredNotes.length === 0) {
    notesList.innerHTML = '<li class="empty-state" style="padding:20px; text-align:center; color:var(--text-dim);">No notes found</li>';
    return;
  }

  filteredNotes
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(note => {
      const li = document.createElement("li");
      li.classList.add("note-item");
      
      // We separate the text click from the delete button click
      li.innerHTML = `
        <div class="note-info">
          <strong>${note.title || "Untitled"}</strong>
          <small>${new Date(note.date).toLocaleDateString()}</small>
        </div>
        <button class="delete-note-btn" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;

      // Click on the text loads the note
      li.querySelector(".note-info").addEventListener("click", () => loadNoteContent(note));

      // Click on the trash icon deletes the note
      const deleteBtn = li.querySelector(".delete-note-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent opening the note when deleting
        deleteNote(note.id);
      });

      notesList.appendChild(li);
    });
}

// Function to Delete a Note
function deleteNote(id) {
  if(confirm("Are you sure you want to delete this note?")) {
    let notes = JSON.parse(localStorage.getItem("learningNotes")) || [];
    notes = notes.filter(note => note.id !== id);
    localStorage.setItem("learningNotes", JSON.stringify(notes));
    
    // If we deleted the note currently on screen, clear the editor
    if (currentNote && currentNote.id === id) {
      currentNote = null;
      titleInput.value = "";
      contentArea.value = "";
    }
    
    loadNotes();
  }
}

// Save note
saveBtn.addEventListener("click", () => {
  const title = titleInput.value.trim();
  const content = contentArea.value.trim();
  if (!content && !title) return alert("Please write something before saving.");

  let notes = JSON.parse(localStorage.getItem("learningNotes")) || [];

  if (currentNote) {
    // Update existing
    const index = notes.findIndex(n => n.id === currentNote.id);
    if (index !== -1) {
        notes[index] = { ...notes[index], title, content, date: new Date() };
    }
  } else {
    // Create new
    const newNote = {
      id: Date.now(),
      title,
      content,
      date: new Date()
    };
    notes.push(newNote);
    currentNote = newNote;
  }

  localStorage.setItem("learningNotes", JSON.stringify(notes));
  loadNotes();
  alert("Note saved ✅");
});

// New note button
newNoteBtn.addEventListener("click", () => {
  currentNote = null;
  titleInput.value = "";
  contentArea.value = "";
  titleInput.focus();
});

// Load content into editor
function loadNoteContent(note) {
  currentNote = note;
  titleInput.value = note.title;
  contentArea.value = note.content;
}

// Search functionality
if(searchInput) {
    searchInput.addEventListener("input", loadNotes);
}

// Sidebar Mobile Logic
const burger = document.getElementById('burger');
const sidebar = document.getElementById('sidebar');

if(burger && sidebar) {
    burger.addEventListener('click', () => {
        burger.classList.toggle('active');
        sidebar.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !burger.contains(e.target)) {
            sidebar.classList.remove('open');
            burger.classList.remove('active');
        }
    });
}