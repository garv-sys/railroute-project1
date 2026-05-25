import { getTrainSchedule } from './src/services/irctcService';
(async () => {
  const res = await getTrainSchedule('12393');
  console.log(JSON.stringify(res, null, 2));
})();
