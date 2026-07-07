import { CreatorLife3D } from "./CreatorLife3D";

const prototype = CreatorLife3D.prototype as any;

if (!prototype.__indoorAtmosphereFixPatched) {
  prototype.__indoorAtmosphereFixPatched = true;
  const originalConfigureLights = prototype.configureLights;

  prototype.configureLights = function (): void {
    // O quarto é um ambiente pequeno e fechado. A névoa de distância da cena
    // atravessava móveis e parecia fumaça durante chuva ou tempestade.
    this.scene.fog = null;
    originalConfigureLights.call(this);
  };
}
