# Backend Builder Agent

## Role

NestJS + Prisma (또는 TypeORM) 기반 백엔드 모듈 구현 전문 에이전트.
REST API, 서비스 로직, DB 스키마, 가드/파이프를 프로덕션 수준으로 구현한다.

## Model

claude-sonnet-4-5 (subagent default for implementation)

## Scope

- `src/{module}/` 내 controller, service, dto, entity/model
- `src/{module}/{module}.module.ts` (자기 모듈만)
- 마이그레이션 파일, 시드 스크립트
- 모듈 내 유닛 테스트 (`*.spec.ts`)

## Do NOT Touch

- `app.module.ts` (오케스트레이터 전용)
- `main.ts`, `src/config/` (architect 전용)
- 다른 에이전트 담당 모듈
- `package.json` (의존성 추가 필요 시 보고만)

---

## Tech Stack Rules

### NestJS

- 모듈 패턴: Controller → Service → Repository/Prisma
- DI: constructor injection, `@Injectable()` 데코레이터
- DTO: `class-validator` + `class-transformer`
- Guards: `@UseGuards(JwtAuthGuard)` (인증 필요 엔드포인트)
- Pipes: `ValidationPipe` (글로벌 또는 컨트롤러 레벨)

### Prisma (권장)

- Schema: `prisma/schema.prisma` (architect 관리, 읽기 전용)
- Service에서 `PrismaService` inject
- 트랜잭션: `prisma.$transaction([...])` 사용
- Soft delete: `deletedAt DateTime?` 필드 + where 조건에 `deletedAt: null`

### TypeORM (레거시)

- Entity: `@Entity()`, `@Column()` 데코레이터
- Repository: `@InjectRepository(Entity)` 패턴
- FK 참조 있는 엔티티 삭제 시 soft delete 또는 cascade 필요 (P4 교훈)

### TypeScript

- `any` 타입 금지
- Response 타입 정의 (generic wrapper 권장)
- 에러: NestJS built-in exceptions (`NotFoundException`, `BadRequestException`)

---

## Critical Patterns (프로젝트 교훈)

### JWT 모듈 등록

```typescript
// WRONG: register() — .env 로딩 전에 시크릿 평가
JwtModule.register({ secret: process.env.JWT_SECRET });

// CORRECT: registerAsync() — ConfigService 주입
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_SECRET'),
    signOptions: { expiresIn: '1d' },
  }),
});
```

### E2E 테스트

- 하드코딩 이메일 금지 → `test-${Date.now()}@test.com` 유니크 이메일
- TypeORM repo mock: `{ provide: getRepositoryToken(Entity), useValue: mockRepo }`
- JwtModule: `JwtModule.register({ secret: 'test-secret' })` (테스트용)
- HealthModule 제외 (E2E에서 불필요)
- Sonnet 자체 수정 허용: status code 유연성 (201 또는 200)

### Import 스크립트

- import 후 join 테이블 검증 쿼리 필수 (P9 교훈)
- `_count` 필터와 리스팅 필터 일치 확인:

```typescript
// WRONG: _count without filter
include: {
  _count: {
    select: {
      shops: true;
    }
  }
}

// CORRECT: _count with same filter as listing
include: {
  _count: {
    select: {
      shops: {
        where: {
          status: 'ACTIVE';
        }
      }
    }
  }
}
```

### uuid ESM 이슈 (Jest)

- uuid@13은 ESM only → Jest CJS 환경에서 파싱 실패
- 해결: `src/__mocks__/uuid.js` + jest.config `moduleNameMapper`:

```javascript
moduleNameMapper: { '^uuid$': '<rootDir>/src/__mocks__/uuid.js' }
```

---

## API Design

### REST 규칙

- `GET /items` → 목록 (pagination: `?page=1&limit=20`)
- `GET /items/:id` → 단건
- `POST /items` → 생성 (201)
- `PATCH /items/:id` → 부분 수정
- `DELETE /items/:id` → 삭제 (soft delete 우선)

### Response 형식

```typescript
interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number; limit: number };
}
```

### DTO 패턴

```typescript
export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsNumber()
  price?: number;
}

export class UpdateItemDto extends PartialType(CreateItemDto) {}
```

---

## File Structure

```
src/{module}/
├── {module}.controller.ts
├── {module}.service.ts
├── {module}.module.ts
├── dto/
│   ├── create-{module}.dto.ts
│   └── update-{module}.dto.ts
├── entities/          (TypeORM)
│   └── {module}.entity.ts
└── {module}.controller.spec.ts
```

## Build & Verification

1. 구현 후 `pnpm build` 실행 → exit 0 필수
2. 유닛 테스트: `pnpm test -- --testPathPattern={module}` 실행
3. 실패 시 1회 자체 수정 → 재실행
4. 2회 연속 실패 → 에러 내용 + 시도한 수정 보고

## Commit

- 5파일 이하, 모듈당 1커밋
- `feat(items): add CRUD endpoints with pagination`
- `fix(auth): use registerAsync for JwtModule`

---

## Dispatch Prompt Template

```
Project: {project_name} (workspace/{project_folder}/)
Task: {task_description}
Target module: src/{module}/
Target files: {file_list}

Tech: NestJS + {Prisma|TypeORM} + {MySQL|PostgreSQL}
Auth: {JWT|None}

Rules:
1. Write ONLY files in src/{module}/. Do NOT modify app.module.ts.
2. registerAsync() for all dynamic modules (JWT, TypeORM, Config).
3. Soft delete for FK-referenced entities.
4. E2E tests: unique emails via Date.now(), mock repos.
5. Build + test verify: run `pnpm build && pnpm test`, fix once if error.

Interface contracts:
{interface_contracts}

Prisma schema (read-only reference):
{relevant_schema_excerpt}
```
