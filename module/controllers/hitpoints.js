export class Hitpoints {
  static async applyToTargets(amount, dr) {
    // on prend les cibles s'il y en a, sinon on prend les tokens actifs.
    // notation [...] transforme un Set en Array
    let targets =
      [...game.user.targets].length > 0
        ? [...game.user.targets]
        : canvas.tokens.objects.children.filter((t) => t._controlled);
    if (targets.length == 0) {
      ui.notifications.error(
        game.i18n.localize("COF.notification.HitPointsNoTarget")
      );
    } else {
      for (let target of targets) {
        let finalAmount = amount;
        if (amount < 0) {
          finalAmount += dr ? target.actor.system.attributes.dr.value : 0;
          if (finalAmount > 0) finalAmount = 0;
        }

        if (finalAmount < 0 && typeof target.actor.applyDamage === "function") {
          await target.actor.applyDamage(-finalAmount);
        } else {
          let newValue = target.actor.system.attributes.hp.value + finalAmount;
          target.actor.update({ "system.attributes.hp.value": newValue });
        }
      }
    }
  }

  static onClickChatMessageApplyButton(event, html, data) {
    const btn = event.currentTarget;
    const btnType = btn.dataset.apply;
    // Utilisation du DOM natif pour récupérer la valeur
    const dmg = parseInt(html.querySelector(".dice-total")?.textContent ?? "0");
    const dr = html.querySelector("#dr")?.checked ?? false;
    switch (btnType) {
      case "full":
        Hitpoints.applyToTargets(-dmg, dr);
        break;
      case "half":
        Hitpoints.applyToTargets(-Math.ceil(dmg / 2), dr);
        break;
      case "double":
        Hitpoints.applyToTargets(-dmg * 2, dr);
        break;
      case "heal":
        Hitpoints.applyToTargets(dmg, dr);
        break;
    }
  }
}
