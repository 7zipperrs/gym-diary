import type { Exercise } from './types';

type SeedExercise = Omit<Exercise, 'id'>;

export const SEED_EXERCISES: SeedExercise[] = [
  // Грудь
  { name: 'Жим штанги лёжа', muscleGroup: 'Грудь', type: 'weight' },
  { name: 'Жим гантелей лёжа', muscleGroup: 'Грудь', type: 'weight' },
  { name: 'Жим в тренажёре', muscleGroup: 'Грудь', type: 'weight' },
  { name: 'Отжимания на брусьях', muscleGroup: 'Грудь', type: 'bodyweight' },
  { name: 'Разводка гантелей', muscleGroup: 'Грудь', type: 'weight' },

  // Спина
  { name: 'Становая тяга', muscleGroup: 'Спина', type: 'weight' },
  { name: 'Тяга штанги в наклоне', muscleGroup: 'Спина', type: 'weight' },
  { name: 'Тяга гантели одной рукой', muscleGroup: 'Спина', type: 'weight' },
  { name: 'Подтягивания', muscleGroup: 'Спина', type: 'bodyweight' },
  { name: 'Тяга верхнего блока', muscleGroup: 'Спина', type: 'weight' },
  { name: 'Тяга нижнего блока', muscleGroup: 'Спина', type: 'weight' },

  // Ноги
  { name: 'Приседания со штангой', muscleGroup: 'Ноги', type: 'weight' },
  { name: 'Жим ногами', muscleGroup: 'Ноги', type: 'weight' },
  { name: 'Румынская тяга', muscleGroup: 'Ноги', type: 'weight' },
  { name: 'Выпады с гантелями', muscleGroup: 'Ноги', type: 'weight' },
  { name: 'Разгибание ног', muscleGroup: 'Ноги', type: 'weight' },
  { name: 'Сгибание ног', muscleGroup: 'Ноги', type: 'weight' },
  { name: 'Подъём на носки', muscleGroup: 'Ноги', type: 'weight' },

  // Плечи
  { name: 'Жим штанги стоя', muscleGroup: 'Плечи', type: 'weight' },
  { name: 'Жим гантелей сидя', muscleGroup: 'Плечи', type: 'weight' },
  { name: 'Махи гантелями в стороны', muscleGroup: 'Плечи', type: 'weight' },
  { name: 'Тяга к подбородку', muscleGroup: 'Плечи', type: 'weight' },
  { name: 'Обратная разводка', muscleGroup: 'Плечи', type: 'weight' },

  // Руки
  { name: 'Подъём штанги на бицепс', muscleGroup: 'Руки', type: 'weight' },
  { name: 'Подъём гантелей на бицепс', muscleGroup: 'Руки', type: 'weight' },
  { name: 'Молотки', muscleGroup: 'Руки', type: 'weight' },
  { name: 'Французский жим', muscleGroup: 'Руки', type: 'weight' },
  { name: 'Разгибание на блоке', muscleGroup: 'Руки', type: 'weight' },
  { name: 'Отжимания узким хватом', muscleGroup: 'Руки', type: 'bodyweight' },

  // Пресс
  { name: 'Планка', muscleGroup: 'Пресс', type: 'time' },
  { name: 'Скручивания', muscleGroup: 'Пресс', type: 'bodyweight' },
  { name: 'Подъём ног в висе', muscleGroup: 'Пресс', type: 'bodyweight' }
];
