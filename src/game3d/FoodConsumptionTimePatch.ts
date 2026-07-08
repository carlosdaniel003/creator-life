import { CreatorLife3D } from "./CreatorLife3D";

const PATCH_FLAG = "__foodConsumptionTimePatched";
const HALF_HOUR = 0.5;
const FOOD_ACTIONS = new Set(["Comprar refeição", "Comprar água"]);

const prototype = CreatorLife3D.prototype as any;

if (!prototype[PATCH_FLAG]) {
  prototype[PATCH_FLAG] = true;

  const originalShowModal = prototype.showModal;

  prototype.showModal = function (
    title: string,
    body: string,
    actions: Array<{
      label: string;
      action: () => void | Promise<void>;
      secondary?: boolean;
    }>
  ): void {
    const isFoodModal = title === "Cozinha e hidratação";
    const adjustedBody = isFoodModal
      ? body.replaceAll("consome uma hora", "consome 30 minutos")
      : body;

    const adjustedActions = isFoodModal
      ? actions.map((action) => {
          if (!FOOD_ACTIONS.has(action.label)) return action;

          return {
            ...action,
            action: () => runWithHalfHourAdvance(this, action.action)
          };
        })
      : actions;

    originalShowModal.call(this, title, adjustedBody, adjustedActions);
  };
}

function runWithHalfHourAdvance(
  runtime: any,
  action: () => void | Promise<void>
): void | Promise<void> {
  const currentAdvanceTime = runtime.advanceTime;

  runtime.advanceTime = (hours: number): void => {
    const adjustedHours = hours === 1 ? HALF_HOUR : hours;
    currentAdvanceTime.call(runtime, adjustedHours);
  };

  try {
    const result = action();

    if (result && typeof (result as Promise<void>).finally === "function") {
      return (result as Promise<void>).finally(() => {
        runtime.advanceTime = currentAdvanceTime;
      });
    }

    runtime.advanceTime = currentAdvanceTime;
    return result;
  } catch (error) {
    runtime.advanceTime = currentAdvanceTime;
    throw error;
  }
}
