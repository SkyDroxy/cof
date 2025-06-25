import { COF } from "./config.js";

export class COFActiveEffectConfig extends ActiveEffectConfig {
  get template() {
    return "systems/cof/templates/effects/active-effect-config.hbs";
  }

  async getData(options = {}) {
    let context = await super.getData(options);
    context.config = COF;

    let lockDuringPause =
      game.settings.get("cof", "lockDuringPause") && game.paused;
    options.editable &= game.user.isGM || !lockDuringPause;

    let targetType = this.object.getFlag("cof", "targetType");

    if (!targetType) {
      this.object.setFlag("cof", "targetType", "SelectEffectTarget");
      targetType = "SelectEffectTarget";
    }

    context.targetType = targetType;

    // Champs personnalisés pour le script et la portée
    context.hasScript = this.object.getFlag("cof", "hasScript") || false;
    context.script = this.object.getFlag("cof", "script") || "";

    context.hasRange = this.object.getFlag("cof", "hasRange") || false;
    context.range = this.object.getFlag("cof", "range") || "";
    context.rangeTarget = this.object.getFlag("cof", "rangeTarget") || "all";

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html
      .find(".changeEffectTarget")
      .click(this._onChangeffectTarget.bind(this));
  }

  _onChangeffectTarget(event) {
    event.preventDefault();

    let targetType = this.object.getFlag("cof", "targetType");
    if (targetType === "SelectEffectTarget") {
      this.object.setFlag("cof", "targetType", "InputEffectTarget");
    } else this.object.setFlag("cof", "targetType", "SelectEffectTarget");
  }
}
