# 🎮 Ja-eum-nol-i (자음놀이)

실시간 2인 대결 웹 초성 게임

제한된 시간 내에 제시된 초성에 맞는 단어를 상대방보다 빠르게, 많이 입력하여 승리하는 실시간 웹게임입니다.

배포 사이트 : https://chosung-game.vercel.app/

## 1. 📺 레트로컨셉 UI/UX 최적화


- 고전 스타일 인터페이스
  - 하단 작업 표시줄, 우측 시계, 좌측 시작 버튼과 고전 한컴타자 스타일을 접목시켜 고전 스타일을 경험해본 유저에게는 향수를, 새로운 유저에게는 또다른 새로운 경험을 제공함으로써 지루한 학습게임이라는 틀을 깨고 유저들에게 시각적 재미를 같이 느끼며 할수있도록 제작하였습니다.

- 키보드 입력기반 인터페이스 지향
  - 초기 화면에서 '아무 키나 눌러 시작(PRESS ANY KEY)' 방식을 도입하고, 입장 버튼의 문구를 직관적으로 변경하여 사용자 경험을 개선했습니다.
     <img width="800" height="500" alt="스크린샷 2026-07-09 오후 8 26 02" src="https://github.com/user-attachments/assets/7e58a58b-651c-483f-be4a-d68dd96b6e36" />
  - 실시간 타이핑 게임의 특성을 고려하여, 규칙 모달 닫기(`Enter`), 다시 보지 않기(`Spacebar`/ `S`) 기능을 모두 단축키로 제어할 수 있도록 구현했습니다.
  - 불필요한 마우스 동선을 제거함으로써 유저의 편의성을 향상시켰습니다.
  - 확인버튼을 누르지않아도 30초 뒤에 자동으로 닫히고 닉네임 창으로 이동하도록 설정하였습니다.
</br>

<img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/a38359ec-d76b-4d13-93ed-1100bbe30d04" />




## 2. 🔐 안정적인 유저 진입을 위한 유효성 검사

- 실시간 데이터 검증 및 예외 처리
  - 대기실 진입 전 닉네임 글자 수(2~8자) 제한 및 현재 접속 중인 유저와의 중복 여부를 실시간으로 검증하도록 구현했습니다.
 <br>
 <img width="662" height="386" alt="image" src="https://github.com/user-attachments/assets/46183721-a65b-49e3-9f02-691a8fc9e89a" />
 <img width="662" height="386" alt="image" src="https://github.com/user-attachments/assets/866595db-7748-4ae9-8fae-aecff50c8c4f" />

    
- 조건부 UI 활성화로 오작동 방지
  - 유효성 검사를 통과한 경우에만 '설정' 버튼이 활성화되도록 인터페이스를 제어하여,유저의 잘못된 입력을 원천 차단했습니다.
<img width="662" height="386" alt="image" src="https://github.com/user-attachments/assets/70f78be4-6538-4bb2-95f7-6a4aed26f77c" />

## 3. 💬 Socket.io 기반 실시간 대기실 시스템 구축

- 실시간 채팅을 통한 유저 상호작용 유도
  - 대기 룸 내에 실시간 채팅 기능을 도입하여 게임 시작 전 플레이어 간의 소통을 활성화하고, 대기 시간에서 올 수 있는 지루함을 최소화했습니다.
  - </br><img width="800" height="500" alt="스크린샷 2026-07-09 오후 7 52 30" src="https://github.com/user-attachments/assets/5ba7657f-02e7-4c1f-a609-622a9c011dc8" />


- 룸 상태 실시간 동기화 및 시스템 메세지 알림
  - 유저의 입장·퇴장 상태 및 방장의 게임시간 변경 사항을 시스템 메세지를 통해 실시간으로 전송했습니다. 이를 통해 대기실 내 모든 유저가 동기화된 동일한 화면과 정보를 끊김 없이 인지할 수 있도록 구현했습니다.
  - 유저의 레디(준비)/취소 상태와 방장의 강제시작 취소 사항을 시스템 메세지로 표현하여 대기실 내 모든 플레이어에게 실시간 동기화하여 플레이어 간의 싱크를 맞췄습니다.
   
</br>
<img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/3c10b89e-b2e5-4808-b0b1-8b5348e5b8c4" />

</br>
</br>
- 인터랙티브 단축키 가이드 및 동적 애니메이션 연출
  - 2명 이상의 플레이어가 입장 시, 레디 버튼 내 안내 텍스트를 2초 주기로 전환(READY? $\leftrightarrow$ CTRL+ ↵)하여 유저의 단축키 인지율을 높였습니다.
  - 텍스트 변경 타이밍에 맞춰 빛이 좌우로 스쳐 지나가는 인터랙티브 애니메이션 효과를 적용해 시각적 몰입감을 높였습니다.
    </br>
    </br>
  - <img width="500" height="400" alt="playerReadyBtnSwipe" src="https://github.com/user-attachments/assets/47b06517-a8b3-4fd1-bc84-ba58478cef6c" />



## 4. 👑 방장 권한 및 룸 세션 관리

- 방장 권한 자동 위임 및 직관적인 UI 식별자 제공
  - 최초 방 개설자에게 방장 권한을 부여하고, 방장 퇴장 시 남은 유저에게 권한이 자동 위임되는 로직을 구현했습니다.
  - 유저들의 혼선을 줄이기 위해 본인 식별자 (당신)과 방장 식별자 [방장] 표식을 실시간으로 렌더링하여 플레이어가 직관적으로 인식할수있도록 하였습니다.
  - <img width="409" height="270" alt="image" src="https://github.com/user-attachments/assets/8ea907cc-554f-4ed2-83a8-6fd0518f6650" />

- 예외 처리와 안정성을 고려한 게임 옵션 설정
  - 방장은 게임 제한 시간을 선택할 수 있으며 기본시간은 60초이고, 30초/60초/90초/120초 중에 선택할수있으며, 어뷰징 방지를 위해 한 판당 변경 횟수를 3회로 제한했습니다. (방장 위임 시 남은 횟수도 승계)
  - <img width="349" height="149" alt="image" src="https://github.com/user-attachments/assets/55a7b674-c345-4e6a-b1c2-f65940f55feb" />

- 역할 및 인원 기반의 UI 상태 분기 처리
  - 역할별 UI 분기: 방장은 `READY? ➔ GAME START` , 일반 유저는 `READY? ➔ READY!`로 버튼 텍스트를 차별화하여 소소한 방장의 권한으로 부여했습니다.
  - <img width="388" height="183" alt="image" src="https://github.com/user-attachments/assets/3b0c56aa-0ebc-4fb2-87e8-1eff54cff26c" />
  - <img width="388" height="183" alt="image" src="https://github.com/user-attachments/assets/5e216166-be28-47cb-aa33-0d2a7d3f1888" />


  - 인원 수 검증: 레디버튼 비활성화: 대기룸 접속인원이 2명미만일경우 레디 버튼이 비활성화됩니다.
<img width="388" height="183" alt="image" src="https://github.com/user-attachments/assets/92f945ae-e569-48ca-92ff-186bcc069949" />


- 10초 강제시작 및 인터럽트 기능
  - 방장이 레디버튼을 누른 후 상대방이 10초간 레디버튼을 누르지 않으면 '강제시작' 버튼이 활성화되고 강제시작을 알리는 모달창을 뜨게해 유저가 게임을 준비할수있도록 하였습니다.
  - <img width="525" height="699" alt="image" src="https://github.com/user-attachments/assets/d975f6ea-cfce-44f6-b961-d34cbf9c0513" />
  - <img width="800" height="500" alt="스크린샷 2026-07-09 오후 9 06 00" src="https://github.com/user-attachments/assets/dee0fa70-0bf3-43b9-881c-350e0e3f0bbc" />

  - 방장의 '강제시작' 시 방장의 취소버튼 또는 Esc 키로 취소 가능
  - <img width="401" height="358" alt="스크린샷 2026-07-09 오후 9 13 14" src="https://github.com/user-attachments/assets/82debf30-1496-419f-ad3f-9062252b631a" />
  - 양측 모두 Ready 시 취소 불가
  - <img width="401" height="358" alt="image" src="https://github.com/user-attachments/assets/12af8d2f-1f9b-4400-9f31-62adaa800ac2" />


 
- 카운트 다운에서  퇴장유저 발생 시 대기방 이동
  - 카운트다운할때 퇴장 유저가 발생하면 게임이 시작된것이 아니기때문에 기권승이 아니라 대기방으로 돌아가게되고 남은 유저는 레디버튼이 취소됩니다. 
## 5. 🕹️ 인게임 플레이 및 단어 검증

- 3초 카운트다운 애니메이션
  - 게임 시작 3초 전, 시각적 점멸 효과가 있는 모달과 시작 오버레이를 통해 화면을 주시하지 않던 유저도 인지할 수 있도록 설계했습니다.
  -<img width="535" height="555" alt="image" src="https://github.com/user-attachments/assets/ca8fdbeb-d4ae-427a-abcd-e19b817ed5ad" />

- 화면 가시성 최적화
  - 좌측에 본인 영역,우측에는 상대 영역, 하단에 와이드 입력창을 배치하여 텍스트 입력 집중도를 높였습니다.

- 실시간 단어 검증 및 즉각적인 피드백
  - 입력한 단어가 정답일 경우 유저의 단어 목록에 즉시 반영됩니다.
  - <img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/a601b412-b8b5-4212-bfe8-99ffa8022f6d" />

  - 오답이거나 이미 사용한 중복 단어일 경우, 그에 맞는 실패 사유를 UI 피드백으로 즉각 안내하여 유저 편의성을 높였습니다.
  - <img width="500" height="100" alt="image" src="https://github.com/user-attachments/assets/f8ae63eb-fe46-4546-9407-a3bc80d54979" />

- 긴장감을 주는 실시간 타이머 및 종료 처리
  - MM:SS 형식으로 레트로한 감성과 박진감을 느낄수하였고, 타이머가 종료되면 즉시 게임 입력창이 `disabled`되고 종료 오버레이가 출력됩니다.
  - <img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/7cc5e398-1075-4e74-adad-7588a8cfd9d9" />
  - <img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/9cc68630-4f7e-4445-8c25-cfab798268db" />


## 6. 🏆 게임 결과창 및 서버 자원 최적화

- 국어사전 뜻을 포함한 플레이 데이터 리포트
  - 종료 후 나와 상대방이 입력한 단어 목록과 국어사전 뜻을 함께 노출하여 유저에게 학습적 피드백과 시각적 재미를 동시에 제공합니다.

- 사용자 경험을 고려한 직관적 UX 문구 사용
  - 직관적인 승/패 표현 과 `Winner / Loser`를 사용했으며,
    <img width="800" height="500" alt="image" src="https://github.com/user-attachments/assets/8eacd211-1d18-422c-9a57-398bf2928a14" />

    동점일 경우 `시스템 에러: 패자를 찾지 못했습니다` 라는 문구로 유저의 아쉬움을 유쾌하게 넘길수있도록 하였습니다.
    <img width="1375" height="74" alt="image" src="https://github.com/user-attachments/assets/74d5c012-5e9a-46f3-abbb-13574dfe5fc2" />

- 중도 퇴장 예외 처리
  - 게임 진행 중 한 유저가 나가면 점수와 상관없이 즉시 `끈기 있는 대결을 통한 승리 문구(기권승 처리)`로 남은 유저가 허탈감을 느끼지않게 하였습니다.
    <img width="1200" height="102" alt="스크린샷 2026-07-09 오후 7 35 42" src="https://github.com/user-attachments/assets/8861f322-8bb3-4c89-a7d9-28efdcccf728" />

- 효율적인 서버 자원 및 메모리 관리
  - 룸 세션 자동 정리: 결과창 출력 15초 후 시작 화면으로 자동 복귀하며 기존 룸 세션 데이터를 정리합니다.

  - 재매칭 로직 최적화: '다시 하기' 클릭 시 기존에 대기 중인 유저가 있는 방으로 우선 매칭하며, 조건에 맞는 방이 없으면 신규 방을 생성합니다.

  - 인메모리 데이터 삭제: 방에 유저가 아무도 남지 않는 즉시 해당 룸 데이터를 삭제하여 서버 리소스 누수를 방지했습니다.
