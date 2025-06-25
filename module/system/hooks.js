import { CofActor } from "../actors/actor.js";
import { Hitpoints } from "../controllers/hitpoints.js";
import { CharacterGeneration } from "../system/chargen.js";
import { COF } from "./config.js";
import { Macros } from "./macros.js";

export default function registerHooks() {
  Hooks.on("getChatLogEntryContext", (html, options) => {
    let canApplyDamage = (li) => li.find("h2.damage").length;
    let canApplyHealing = (li) => li.find("h2.heal").length;
    options.push(
      {
        name: game.i18n.localize("COF.ui.applyDamage"),
        icon: '<i class="fas fa-user-minus"></i>',
        condition: canApplyDamage,
        callback: (li) => {
          const dmg = parseInt(li.find(".dice-total").text());
          Hitpoints.applyToTargets(-dmg);
        },
      },
      {
        name: game.i18n.localize("COF.ui.applyHalfDamage"),
        icon: '<i class="fas fa-user-shield"></i>',
        condition: canApplyDamage,
        callback: (li) => {
          const dmg = Math.ceil(parseInt(li.find(".dice-total").text()) / 2);
          Hitpoints.applyToTargets(-dmg);
        },
      },
      {
        name: game.i18n.localize("COF.ui.applyDoubleDamage"),
        icon: '<i class="fas fa-user-injured"></i>',
        condition: canApplyDamage,
        callback: (li) => {
          const dmg = parseInt(li.find(".dice-total").text()) * 2;
          Hitpoints.applyToTargets(-dmg);
        },
      },
      {
        name: game.i18n.localize("COF.ui.applyHealing"),
        icon: '<i class="fas fa-user-plus"></i>',
        condition: canApplyDamage,
        callback: (li) => {
          const dmg = parseInt(li.find(".dice-total").text());
          Hitpoints.applyToTargets(dmg);
        },
      },
      {
        name: game.i18n.localize("COF.ui.applyDamage"),
        icon: '<i class="fas fa-user-minus"></i>',
        condition: canApplyHealing,
        callback: (li) => {
          const dmg = parseInt(li.find(".dice-total").text());
          Hitpoints.applyToTargets(-dmg);
        },
      },
      {
        name: game.i18n.localize("COF.ui.applyHealing"),
        icon: '<i class="fas fa-user-plus"></i>',
        condition: canApplyHealing,
        callback: (li) => {
          const dmg = parseInt(li.find(".dice-total").text());
          Hitpoints.applyToTargets(dmg);
        },
      }
    );
  });

  /**
   * Create a macro when dropping an entity on the hotbar
   * Item      - open roll dialog for item
   * Actor     - open actor sheet
   * Journal   - open journal sheet
   * Weapon    - open roll dialog for weapon
   */

  Hooks.on("hotbarDrop", (bar, data, slot) => {
    if (["Actor", "Item", "JournalEntry", "Weapon"].includes(data.type)) {
      Macros.createCofMacro(data, slot);
      return false;
    }
  });

  /**
   * Intercepte les commandes de chat
   * /stat - Jet de caractéristique
   * /skill stat - Jet de caractéristique
   * /stats - Génère les caractéristiques d'un personnage
   */

  Hooks.on("chatMessage", (chatLog, message, chatData) => {
    let regExp;
    regExp = /(\S+)/g;
    let commands = message.match(regExp);
    let command =
      commands.length > 0 && commands[0].split("/").length > 0
        ? commands[0].split("/")[1].trim()
        : null;
    let arg1 = commands.length > 1 ? commands[1].trim() : null;
    const actor = game.cof.macros.getSpeakersActor();

    const validCommands = [
      "for",
      "str",
      "dex",
      "con",
      "int",
      "sag",
      "wis",
      "cha",
      "atc",
      "melee",
      "atd",
      "ranged",
      "atm",
      "magic",
    ];

    if (command && validCommands.includes(command)) {
      game.cof.macros.rollStatMacro(actor, command, 0, 0, null);
      return false;
    } else if (command && command === "skill") {
      if (arg1 && validCommands.includes(arg1)) {
        game.cof.macros.rollStatMacro(actor, arg1, 0, 0, null);
      } else {
        ui.notifications.error(
          game.i18n.localize("COF.notification.chatHook.noSkillSelected")
        );
      }
      return false;
    } else if (command && command === "stats") {
      CharacterGeneration.statsCommand();
      return false;
    }
  });

  Hooks.on("renderChatMessageHTML", (message, html, context) => {
    // Affiche ou non les boutons d'application des dommages
    if (game.settings.get("cof", "displayChatDamageButtonsToAll")) {
      html.querySelectorAll(".apply-dmg").forEach((btn) => {
        btn.addEventListener("click", (ev) =>
          Hitpoints.onClickChatMessageApplyButton(ev, html, context)
        );
      });
    } else {
      if (game.user.isGM) {
        html.querySelectorAll(".apply-dmg").forEach((btn) => {
          btn.addEventListener("click", (ev) =>
            Hitpoints.onClickChatMessageApplyButton(ev, html, context)
          );
        });
      } else {
        html.querySelectorAll(".apply-dmg").forEach((btn) => {
          btn.style.display = "none";
        });
        html.querySelectorAll(".dr-checkbox").forEach((btn) => {
          btn.style.display = "none";
        });
      }
    }

    // Affiche ou non la difficulté
    const displayDifficulty = game.settings.get("cof", "displayDifficulty");
    if (
      displayDifficulty === "none" ||
      (displayDifficulty === "gm" && !game.user.isGM)
    ) {
      html.querySelectorAll(".display-difficulty").forEach((elt) => {
        elt.remove();
      });
    }
  });

  /**
   * Intercepte la création d'un active effect
   * Si l'effet provient d'un item équipable, on disable l'effet si l'item n'est pas équipé (par défaut il n'est pas équipé)
   * Il n'y as pas de preCreateActiveEffect pour les effets transférés depuis un item
   * On procède donc à une mise à jour de l'effet
   */
  Hooks.on("applyActiveEffect", (actor, change, current, delta, changes) => {
    // Vérifie que l'effet provient bien d'un item
    const origin = change.effect?.origin || change.origin;
    if (!origin || !/Item\.[^.]+$/.test(origin)) return;

    // Récupération de l'item parent
    const parts = origin.split(".");
    let item;
    if (parts[0] === "Actor") {
      item = game.actors.get(parts[1])?.items.get(parts[3]);
    } else if (parts[0] === "Scene") {
      const scene = game.scenes.get(parts[1]);
      const token = scene?.tokens.get(parts[3]);
      item = token?.actor?.items.get(parts[5]);
    }
    if (!item) return;

    // Si l'item parent n'est pas équipable, on quitte
    if (!item.system?.properties?.equipable) return;

    // Si l'item n'est pas équipé, on désactive l'effet
    if (!item.system.worn) {
      // On ne peut pas désactiver l'effet ici directement, mais on peut empêcher l'application du changement
      // Pour empêcher l'application, on retourne la valeur courante sans modification
      return current;
    }

    // Sinon, laisse l'effet s'appliquer normalement
  });

  Hooks.on("pauseGame", async () => {
    let lockDuringPause = game.settings.get("cof", "lockDuringPause");
    if (!game.user.isGM && lockDuringPause) {
      updateApplicationToLockDuringPause();
    }
  });

  Hooks.on("clientSettingChanged", async (key, value, options) => {
    if (key === "cof.lockDuringPause") {
      if (!game.user.isGM && game.paused) {
        updateApplicationToLockDuringPause();
      }
    }
  });

  Hooks.on("combatTurn", async (combat, update, options, userId) => {
    console.log(
      "COF | combatTurn hook triggered",
      combat,
      update,
      options,
      userId
    );
    for (let combatant of combat.combatants) {
      const actor = combatant.actor;
      if (!actor) continue;

      for (let effect of actor.effects) {
        const duration = effect.duration;
        if (!duration) continue;

        const { rounds, turns, startRound, startTurn } = duration;
        const currentRound = update.round;
        const currentTurn = update.turn;

        let expired = false;
        if (rounds != null && startRound != null) {
          if (currentRound >= startRound + rounds) expired = true;
        }
        if (turns != null && startTurn != null) {
          if (currentTurn >= startTurn + turns) expired = true;
        }
        if (!expired) continue;

        const flags = effect.flags?.cof || {};
        console.log(
          `COF | Effect "${effect.name}" (${effect.id}) expired:`,
          expired,
          "Flags:",
          flags
        );
        // Si c'est la source, on désactive seulement
        if (flags.isSource === true || flags.isSource === undefined) {
          console.info(
            `COF | Disabling effect (expired, source): ${effect.name} (${effect.id})`
          );
          await effect.update({ disabled: true });
        } else {
          // Sinon, on supprime l'effet chez les cibles
          console.info(
            `COF | Deleting effect (expired, target): ${effect.name} (${effect.id})`
          );
          await effect.delete();
        }
      }
    }
  });

  Hooks.on("moveToken", async (document, movement, operation, user) => {
    const movedToken = canvas.tokens.get(document.id);
    if (!movedToken) return;
    console.log(
      "COF | Token moved (moveToken hook):",
      movedToken.name,
      movedToken.id
    );
    console.log("COF | Token moved:", movedToken.name, movedToken.id);

    // 1. Suppression si hors de portée
    for (let token of canvas.tokens.placeables) {
      if (!token.actor) continue;
      for (let effect of token.actor.effects) {
        const flags = effect.flags?.cof;
        if (!flags?.range || !flags?.sourceTokenId) continue;

        // Si le token déplacé est la source OU la cible de l'effet
        if (token.id === flags.sourceTokenId || token.id === movedToken.id) {
          const sourceToken = canvas.tokens.get(flags.sourceTokenId);
          if (!sourceToken) continue;
          const distance = canvas.grid.measureDistance(
            token.center,
            sourceToken.center
          );
          const rangeValue = Number(flags.range);
          if (!isNaN(rangeValue) && distance > rangeValue) {
            console.info(
              `COF | Deleting effect "${effect.name}" (${effect.id}) on "${token.name}" (${token.id}) - out of range`
            );
            await effect.delete();
          }
        }
      }
    }

    // 2. Ajout/réactivation si rapprochement
    for (let token of canvas.tokens.placeables) {
      if (!token.actor) continue;
      for (let effect of token.actor.effects) {
        const flags = effect.flags?.cof;
        if (!flags?.range || !flags?.sourceTokenId) continue;
        // On ne traite que les effets "maîtres" (isSource === true)
        if (flags.isSource === false) continue;

        const sourceToken = canvas.tokens.get(flags.sourceTokenId);
        if (!sourceToken) continue;

        // Pour chaque token cible potentiel (hors source)
        for (let target of canvas.tokens.placeables) {
          if (!target.actor || target.id === sourceToken.id) continue;

          const distance = canvas.grid.measureDistance(
            target.center,
            sourceToken.center
          );
          const rangeValue = Number(flags.range);
          if (isNaN(rangeValue) || distance > rangeValue) continue;

          // Vérifie si l'effet est déjà présent et actif sur la cible
          const existing = target.actor.effects.find(
            (e) => e.name === effect.name && e.origin === effect.origin
          );
          if (existing && !existing.disabled) continue;

          // Applique l'effet si absent ou désactivé
          let effectData = foundry.utils.duplicate(effect);
          if (effectData.flags?.cof) {
            effectData.flags.cof.isSource = false;
          }
          effectData.disabled = false;
          await target.actor.createEmbeddedDocuments("ActiveEffect", [
            effectData,
          ]);
          console.info(
            `COF | (Re)applying effect "${effect.name}" (${effect.id}) to "${target.name}" (${target.id}) - entered range`
          );
        }
      }
    }
  });
}

function updateApplicationToLockDuringPause() {
  Object.values(ui.windows).forEach((app) => {
    COF.applicationsToLockDuringPause.forEach((appClass) => {
      if (app instanceof appClass) app.render();
    });
  });
}
