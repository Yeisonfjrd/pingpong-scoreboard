<img width="1031" height="661" alt="Screenshot 2026-02-13 134553" src="https://github.com/user-attachments/assets/910d93f0-df4f-4ba2-b08f-d0b196cb5eae" />
Ping Pong Scoreboard

This is a simple web application to track Ping Pong scores. I built this project to practice JavaScript (applying the logic I learned in university with C and Java) and to create a useful tool for my matches.

**Features**

Score Tracking: Simple interface to add or remove points for two players.

Serve Indicator: It shows who serves. The serve changes every 2 points, and every point from 10-10. Each new game starts with the other player.

Undo: The "Deshacer" button (or saying "deshacer") goes back one step, even after a game ends.

Voice Control: You can use the microphone to add points without touching the screen.

Sessions: One scoreboard for each rival, for example "Yeison vs Papá" and "Yeison vs Hermano". Each one keeps its own wins and the list of its last games (date and score). You change between them at the top.

Backup: Everything is saved in your browser, on this device. With "Exportar respaldo" you download a file with all your sessions, and with "Importar respaldo" you load it on another phone or PC.

Bluetooth Remote: A cheap presentation remote (or any keyboard) adds points without touching the screen. Left / Page Up is a point for player 1, right / Page Down for player 2, and the "b" or "." button undoes. If your remote sends other keys, use "Configurar botones" and press each button.

Install and Offline: You can install it as an app on your phone ("Add to home screen"). After the first visit it works without internet, and the screen stays on while you play.

Stats: It shows total points, games, longest streak of points in a row and session time.

**Technologies Used**
HTML5

Tailwind CSS (built to styles.css)

JavaScript (Vanilla)

Web Speech API

**How to run**

To use the voice recognition feature, you must run this on a local server (like Live Server in VS Code) or host it on HTTPS.

Due to browser security rules, the microphone will not work if you just open the index.html file directly.

**How to use**

Enter the names for Player 1 and Player 2.

Click the microphone button to activate voice control.

Say commands like "Punto para Yeison", "punto dos", "dos puntos para uno", "borrar uno" or "deshacer". (In the next days, i create a version in english)

The first player to reach 11 points wins the game.

**Tests**

If you change classes in index.html or app.js, build the CSS again with `npm run build` (or `npm run dev:css` while you work).

The game rules and the voice commands live in game.js, and the sessions in sessions.js, without the page. Run the tests with:

```
npm test
```

*Created by Yeison.*
