import { useEffect, useState } from 'react';
import axios from 'axios';
import logo from "./assets/logo.png";
import './App.css';

function App() {
  const [notes, setNotes] = useState([]);
  const [form, setForm] = useState({ user_name: '', title: '', content: '' });

  useEffect(() => { fetchNotes(); }, []);

  const fetchNotes = async () => {
    try {
      const res = await axios.get('http://localhost:5000/notes');
      setNotes(res.data);
    } catch (err) { console.error(err); }
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const addNote = async () => {
    if (!form.user_name.trim() || !form.title.trim() || !form.content.trim()) return;
    try {
      const res = await axios.post('http://localhost:5000/notes', form);
      setNotes(prev => [res.data, ...prev]);
      setForm({ user_name: '', title: '', content: '' });
    } catch (err) { console.error(err); }
  };

  const deleteNote = async (id) => {
    try {
      await axios.delete(`http://localhost:5000/notes/${id}`);
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) { console.error(err); }
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <img 
            src={logo}
            className="coffee-icon" 
          />
          <h1 className="title">Coffee Notes</h1>
          <p className="subtitle">Brew your thoughts, one note at a time</p>
        </header>

        <div className="form-container">
          <div className="form-group">
            <label className="input-label" htmlFor="user_name">Your Name</label>

            <div className="form-group">
              <label className="input-label" htmlFor="user_name">Your Name</label>

              <input 
                id="user_name"
                name="user_name" 
                value={form.user_name} 
                onChange={handleChange} 
                className="input-field"
              />
            </div>
          <div className="form-group">
            <label className="input-label" htmlFor="title">Note Title</label>


            <div className="form-group">
              <label className="input-label" htmlFor="title">Note Title</label>

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
            <span className="button-icon">📝</span>
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
              {notes.map(note => (
                <div key={note.id} className="note-card">
                  <div className="note-header">
                    <h3 className="note-title">{note.title}</h3>
                    <button 
                      onClick={() => deleteNote(note.id)} 
                      className="delete-button"
                      title="Delete note"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="note-content">{note.content}</div>
                  <div className="note-footer">
                    <span className="note-author">👤 {note.user_name}</span>
                    <span className="note-date">
                      {new Date(note.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
