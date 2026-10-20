<img width="1031" height="661" alt="Screenshot 2026-02-13 134553" src="https://github.com/user-attachments/assets/910d93f0-df4f-4ba2-b08f-d0b196cb5eae" />
Ping Pong Scoreboard

This is a simple web application to track Ping Pong scores. I built this project to practice JavaScript (applying the logic I learned in university with C and Java) and to create a useful tool for my matches.

**Features**

Score Tracking: Simple interface to add or remove points for two players.

Serve Indicator: It shows who serves. The serve changes every 2 points, and every point from 10-10. Each new game starts with the other player.

Undo: The "Deshacer" button (or saying "deshacer") goes back one step, even after a game ends.

Voice Control: You can use the microphone to add points without touching the screen.

Game History: The app counts how many games each player has won.

Stats: It shows total points, games, longest streak of points in a row and session time.

**Technologies Used**
HTML5

Tailwind CSS

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

The game rules and the voice commands live in game.js, without the page. Run the tests with:

```
npm test
```

*Created by Yeison.*
