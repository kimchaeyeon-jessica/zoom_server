import express from 'express';
import { School } from '../types/school';

const router = express.Router(); // router:

// router은 get요청이 들어왔을 때 무엇을 할지 지정해줌
// req: request요청에 대한 정보 res: respond응답할 것에 대한 구성들이 들어있음
// data는 아이디, 이름 등(리스트)을 가지고 있는 객체
// 원하는 상태 코드 지정, 데이터 전송해달라 지정
const data: School[] = [
  {
    id: 1,
    name: '이화여고',
  },
];

router.get('/', (req, res) => res.status(200).json(data));

router.get('/:schoolId', (req, res) => {
  const { schoolId } = req.params;
  if (!schoolId) {
    return res.status(400).json();
  }

  const schoolIdNumber: number = parseInt(schoolId, 10); //parseInt: 문자열을 숫자로,10진수로
  if (!data.some(({ id }) => id === schoolIdNumber)) {
    return res.status(404).json();
  }
  const filtered = data.filter((item: School) => item.id === schoolIdNumber);
  return res.status(200).json(filtered[0]);
});

router.post('/', (req, res) => {
  const school: School = req.body as School;
  if (!school) {
    return res.status(400).json();
  }
  data.push(school);
  return res.status(201).json();
});

export default router;
