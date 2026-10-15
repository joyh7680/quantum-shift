# 코드모스 GLB 에셋 패키지

패키지 작성일: 2026-10-15 (Asia/Seoul)

로컬 에셋 카탈로그에 등록된 GLB 원본 **148개**를 담았습니다. 웹사이트 접속이나 제작툴 설치 없이 사용할 수 있습니다. 원본 바이너리는 변환하거나 수정하지 않았으며, 등록된 SHA-256과 일치하는지 확인했습니다.

## 폴더 구성

```text
models/
  space-travel/ships/       우주선 29개
  dosan-park/props/         도산공원 시설·소품 72개
  dosan-park/characters/    도산공원 캐릭터 47개
manifest.json              개발용 파일 목록·메타데이터
asset-list.csv             이름과 파일 경로를 찾기 위한 표 (UTF-8 BOM)
SHA256SUMS.txt              GLB 무결성 검증용 체크섬
README.md                  이 문서
```

GLB 합계 용량: 71,444,856 bytes (압축 전).

파일명은 원본 식별자를 유지했습니다. 사람이 읽는 이름은 `asset-list.csv`의 `name`, 또는 `manifest.json`의 `assets[].name`에서 확인하세요. 해시가 포함된 이름은 캐시 및 원본 추적을 위해 그대로 사용하는 것을 권합니다. 이 패키지의 `models/`를 기준으로 상대 경로를 제공합니다. 개인 컴퓨터의 절대 경로와 계정 정보는 포함하지 않습니다.

## 먼저 알아둘 점

- 형식은 GLB / glTF 2.0입니다. 모든 모델의 버퍼·이미지가 GLB 내부 또는 data URI에 포함되어 있어 별도 텍스처 다운로드가 필요 없습니다.
- 전체 파일 검사 결과: 애니메이션 클립 0개, glTF `skins`가 있는 파일 0개입니다. 캐릭터는 원본에서 내보낸 정적인 포즈(`authored-rest`)입니다. 걷기·공격 등의 애니메이션이 포함된 캐릭터 팩으로 해석하지 마세요.
- `skinKey`, `skinId`, `spineName`은 원래 프로젝트의 캐릭터/외형 매핑 정보입니다. 이 필드가 있다는 것만으로 GLB에 리깅, Spine 데이터 또는 애니메이션이 포함된다는 뜻은 아닙니다.
- 게임의 이동·상호작용·충돌 판정·AI·사운드·카메라·원본 스크립트는 포함하지 않습니다. 시설/소품 일부는 여러 하위 메시가 묶인 모델입니다.
- 원본 좌표·배율·노드 변환을 유지했습니다. 파일마다 크기와 피벗이 다를 수 있으므로, 바운딩 박스로 카메라를 맞춘 다음 프로젝트에 맞게 배율을 정하세요. glTF 좌표 규약은 오른손 좌표계와 +Y 위쪽입니다. 원본 제작 단위가 실제 미터인지까지 검증한 패키지는 아닙니다.
- 사용된 확장: EXT_mesh_gpu_instancing, KHR_lights_punctual, KHR_materials_emissive_strength, KHR_materials_unlit, KHR_texture_transform. 각 파일의 정확한 목록은 매니페스트의 `extensionsUsed`, `extensionsRequired`를 확인하세요. 대상 엔진의 로더가 해당 확장을 지원해야 원본과 유사하게 표시됩니다.

## 파일 찾기 / 코드에서 선택하기

`manifest.json`은 다음 구조입니다. 이름이 같은 변형이 있을 수 있으므로 로딩에는 `file` 또는 `sha256`을 식별자로 사용하세요.

```js
const manifest = await fetch('/manifest.json').then(response => response.json());
const lucy = manifest.assets.find(asset => asset.skinKey === 'lucy');
const spaceships = manifest.assets.filter(asset => asset.category === 'spaceship');
// lucy.file: models/dosan-park/characters/character-lucy....glb
```

`category`는 `spaceship`, `prop`, `character` 중 하나입니다. `sourceFiles`는 원본 프로젝트 내 상대 소스 경로를 기록한 출처 정보이며, 이 ZIP에 해당 스크립트가 포함되어 있다는 뜻은 아닙니다. `selectable`은 원본 앱의 선택 가능 여부 메타데이터입니다.

## Three.js에서 불러오기

기존 Three.js 프로젝트에서 사용하세요. `three`와 `three/addons/`는 같은 설치 버전을 사용합니다. 아래 예시는 Vite 등의 번들러가 있는 프로젝트를 전제로 합니다. 패키지의 `models/`와 `manifest.json`을 프로젝트의 `public/` 폴더 아래에 복사하세요. 아래 함수는 기존 렌더링 루프에서 쓰는 `scene`과 원근 카메라(`PerspectiveCamera`)를 받습니다.

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadLucy(scene, camera) {
  const response = await fetch('/manifest.json');
  if (!response.ok) throw new Error('manifest.json 로딩 실패');
  const manifest = await response.json();
  const asset = manifest.assets.find(item => item.skinKey === 'lucy');
  if (!asset) throw new Error('루시 모델을 찾을 수 없습니다.');

  const gltf = await new GLTFLoader().loadAsync('/' + asset.file);
  scene.add(gltf.scene);
  // PBR 재질이 보이도록 기본 조명을 추가합니다.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(5, 10, 7);
  scene.add(light);

  const box = new THREE.Box3().setFromObject(gltf.scene);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const halfHorizontalFov = Math.atan(Math.tan(halfFov) * camera.aspect);
  const distance = Math.max(
    size.y / (2 * Math.tan(halfFov)),
    size.x / (2 * Math.tan(halfHorizontalFov))
  ) * 1.3 + size.z / 2;
  camera.position.set(center.x, center.y, center.z + Math.max(distance, 1));
  camera.near = Math.max(0.001, distance / 1000);
  camera.far = Math.max(100, distance * 100);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  // OrbitControls 사용 시 controls.target.copy(center); controls.update();
  return gltf;
}
```

- 반드시 로컬 개발 서버나 배포 서버를 통해 여세요. `file://`로 HTML을 열면 fetch/CORS 제약으로 로드가 실패할 수 있습니다.
- 앱이 하위 경로에 배포되면 `/manifest.json`과 모델 URL의 앞부분을 앱의 base URL에 맞게 변경하세요.
- 모델이 검거나 보이지 않으면 먼저 로딩 오류, 조명, 카메라 위치, 배율을 확인하세요. 원본 프로젝트의 조명·후처리까지 복제한 패키지는 아니므로 화면 색감은 다를 수 있습니다.
- 재사용할 때는 로딩 결과를 캐시하고, 독립적인 인스턴스가 필요하면 씬을 복제하세요. 사용을 마친 geometry/material/texture는 앱의 수명 관리 정책에 맞게 정리하세요.

## 다른 도구에서 사용

- **Blender**: File → Import → glTF 2.0에서 GLB를 선택합니다.
- **Godot**: 프로젝트 폴더에 GLB를 복사해 임포트한 뒤 씬으로 인스턴스화합니다.
- **Unity**: 사용 중인 Unity 버전에 맞는 glTF/GLB 임포터를 설치한 뒤 가져옵니다. GLB 임포트 지원과 머티리얼 변환은 임포터에 따라 달라집니다.

## 원본 검증

macOS/Linux에서 압축을 푼 최상위 폴더에서 실행합니다.

```sh
shasum -a 256 -c SHA256SUMS.txt
```

각 항목의 SHA-256은 `manifest.json`과 `asset-list.csv`에도 있습니다. ZIP 생성 후에도 모든 GLB를 다시 읽어 체크섬을 검증했습니다.

## 출처와 사용 범위

우주여행 프로젝트의 우주선 원본과, 도산공원 프로젝트에서 내보낸 시설·소품·캐릭터 GLB입니다. 이 패키지는 파일 전달 및 개발 연동을 위한 묶음이며, 새로운 라이선스나 재배포 권한을 부여하지 않습니다. 외부 공개·상업적 재배포 범위는 원본 프로젝트의 권한과 라이선스를 따릅니다.
