import { buildStatus, ENGINEERING_PHASE } from '../../utils/build-info';

Page({
  data: {
    title: '三味茶屋',
    status: buildStatus(ENGINEERING_PHASE),
  },
});
