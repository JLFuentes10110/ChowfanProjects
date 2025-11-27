# 🌐 ChowfanProjects  
A blockchain-based project with a clean architecture and seamless integration across frontend, backend, and database layers.  

---

## 🚀 Tech Stack
- **Frontend:** JavaScript (React)  
- **Backend:** Java (Spring Boot)  
- **Database:** PostgreSQL  

---

## 🎨Web Page
![Demo GIF](frontend/src/assets/Chowfan.gif)

---

## 🔗 API Interactions

| Action         | Method  | Endpoint        |
|----------------|---------|-----------------|
| Create Note    | POST    | `/notes`        |
| Get All Notes  | GET     | `/notes`        |
| Get Single Note| GET     | `/notes/:id`    |
| Update Note    | PUT     | `/notes/:id`    |
| Delete Note    | DELETE  | `/notes/:id`    |

---

## 🗄️ Database Schema: `notes` Table  

| Column      | Type      | Constraints |
|-------------|-----------|-------------|
| id          | SERIAL    | **PK**      |
| user_name   | VARCHAR   |             |
| title       | VARCHAR   |             |
| content     | TEXT      |             |
| created_at  | TIMESTAMP |             |

---

## 📌 Project Notes
- Designed for modular scalability.  
- Built with blockchain integration in mind.  

---

## 👩‍💻 Members
- **Alyssa Blanche S. Alivio**  
- **Japeth Luke C. Fuentes**  
- **Laura Alexia Jane Fortugaliza**  
- **Dante L. Ygot**  

---

## ⚠️ Disclaimer
Everything in this project is **tentative** and may be **subject to change**.  

---
💡 *Contributions, issues, and feature requests are welcome!*
