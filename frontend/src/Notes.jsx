import React from "react";
import CoffeeMakerIcon from "@mui/icons-material/CoffeeMaker";
import DeleteIcon from "@mui/icons-material/Delete";
import FaceIcon from "@mui/icons-material/Face";
import logo from "./assets/logo.png";
import './App.css';

export default function Notes({
  form,
  notes,
  handleChange,
  addNote,
  showDeleteModal,
  setShowDeleteModal,
  noteToDelete,
  setNoteToDelete,
  deleteNote
}) {
  return (
    <div className="notes-view">
      <header className="header">
        <img src={logo} className="coffee-icon" />
        <h1 className="title">Coffee Notes</h1>
        <p className="subtitle">Brew your thoughts, one note at a time</p>
      </header>

      <div className="form-container">
        <div className="form-group">
          <label className="input-label" htmlFor="user_name">
            Your Name
          </label>
          <input
            id="user_name"
            name="user_name"
            value={form.user_name}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        <div className="form-group">
          <label className="input-label" htmlFor="title">
            Note Title
          </label>
          <input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        <div className="form-group">
          <textarea
            name="content"
            value={form.content}
            onChange={handleChange}
            placeholder="What's brewing in your mind?"
            rows={4}
            className="textarea-field"
          />
        </div>

        <button onClick={addNote} className="add-button">
          <CoffeeMakerIcon />
          Brew New Note
        </button>
      </div>

      <div className="notes-container">
        {notes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <p>No notes yet. Start brewing your first thought!</p>
          </div>
        ) : (
          <div className="notes-grid">
            {notes.map((note) => (
              <div key={note.id} className="note-card">
                <div className="note-header">
                  <h3 className="note-title">{note.title}</h3>

                  <button
                    onClick={() => {
                      setNoteToDelete(note.id);
                      setShowDeleteModal(true);
                    }}
                    className="delete-button"
                    title="Delete note"
                  >
                    <DeleteIcon />
                  </button>
                </div>

                <div className="note-content">{note.content}</div>

                <div className="note-footer">
                  <span className="note-author">
                    <FaceIcon /> {note.user_name}
                  </span>
                  <span className="note-date">
                    {new Date(note.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DELETE MODAL */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3>Delete Note</h3>
            <p>Are you sure you want to delete this note?</p>

            <div className="modal-buttons">
              <button
                className="cancel-delete"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>

              <button
                className="confirm-delete"
                onClick={() => {
                  deleteNote(noteToDelete);
                  setShowDeleteModal(false);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
