import './style.css';
import { Game } from '@game/game';

/** Punto di ingresso: crea il gioco e lo avvia. Nient'altro. */
const game = new Game(document);
game.start();
