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

///검색기능
router.get('/', (req, res) => {
  const { name } = req.query; //req.query가 '?name=학교이름' 을 기존의 주소에 붙여서 검색하면 검색하게 해줌(인솜니아 학교 전체불러오기 에서)
  const result = [];
  if (name) {
    const filtered = data.filter((school: School) => school.name === name);
    result.push(...filtered);
  } else {
    result.push(...data);
  }
  return res.status(200).json(result);
});

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
  let maxId = 0;
  for (const item of data) {
    if (item.id > maxId) maxId = item.id;
  } //새로운 ID 부여하기 //이런식으로도 새로운 ID 부여 가능
  /*const new Id: number = Math.max(...data.map((item:School)=>item.id))+1;
  const school: School = {
    name,
    id: newId,
  };*/ data.push({
    id: maxId + 1,
    name: school.name,
  });
  return res.status(201).json();
});

router.put('/:schoolId', (req, res) => {
  const { schoolId } = req.params;
  if (!schoolId) {
    return res.status(400).json();
  }

  const schoolIdNumber: number = parseInt(schoolId, 10);
  if (!data.some(({ id }) => id === schoolIdNumber)) {
    return res.status(404).json();
  }
  const school: School = req.body as School;
  if (school.id !== schoolIdNumber) {
    return res.status(400).json();
  } //전달받은 데이터와 일치하지 않으면 에러

  const index: number = data.findIndex((existSchool: School) => existSchool.id === schoolIdNumber);
  data[index] = school;
  return res.status(200).json();
});

router.delete('/:schoolId', (req, res) => {
  const { schoolId } = req.params;
  if (!schoolId) {
    return res.status(400).json();
  }

  const schoolIdNumber: number = parseInt(schoolId, 10);
  if (!data.some(({ id }) => id === schoolIdNumber)) {
    return res.status(404).json();
  }

  const index: number = data.findIndex((school: School) => school.id === schoolIdNumber);
  data.splice(index, 1);
  return res.status(200).json();
});

export default router;
