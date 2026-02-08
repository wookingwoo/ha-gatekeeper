import type { Dispatch, SetStateAction } from "react";
import { HaEntity, Role } from "../api";
import { ActionFormState } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

export function ActionBuilder({
  actionForm,
  setActionForm,
  roleOptions,
  serviceMap,
  entityMap,
  onCreate,
  isDisabled
}: {
  actionForm: ActionFormState;
  setActionForm: Dispatch<SetStateAction<ActionFormState>>;
  roleOptions: Role[];
  serviceMap: Map<string, string[]>;
  entityMap: Map<string, HaEntity[]>;
  onCreate: () => void;
  isDisabled: boolean;
}) {
  const missingRequired: string[] = [];
  if (!actionForm.id.trim()) missingRequired.push("Action ID");
  if (!actionForm.name.trim()) missingRequired.push("Action Name");
  if (actionForm.roleIds.length === 0) missingRequired.push("Role");

  const selectBase =
    "h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";
  const multiSelectBase =
    "h-28 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">기본 정보</p>
            <p className="text-xs text-slate-500">
              액션 식별자와 이름은 API 호출에 사용됩니다.
            </p>
          </div>
          <div className="rounded-full border border-slate-800 bg-slate-900/70 px-3 py-1 text-xs text-slate-400">
            {missingRequired.length > 0
              ? `필수 항목: ${missingRequired.join(", ")}`
              : "필수 항목 모두 입력됨"}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-id">
              Action ID <span className="text-rose-300">필수</span>
            </label>
            <Input
              id="action-id"
              placeholder="예: living_room_lights_on"
              value={actionForm.id}
              onChange={(event) => setActionForm({ ...actionForm, id: event.target.value })}
            />
            <p className="text-xs text-slate-500">
              <span className="font-mono">/v1/actions/{"{id}"}</span> 경로에 사용됩니다.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-name">
              Action Name <span className="text-rose-300">필수</span>
            </label>
            <Input
              id="action-name"
              placeholder="예: 거실 조명 켜기"
              value={actionForm.name}
              onChange={(event) => setActionForm({ ...actionForm, name: event.target.value })}
            />
            <p className="text-xs text-slate-500">운영자가 이해할 수 있는 이름을 입력하세요.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-desc">
              Description
            </label>
            <Textarea
              id="action-desc"
              className="min-h-[84px]"
              placeholder="예: 저녁 모드에서 거실 조명을 켭니다."
              value={actionForm.description}
              onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase text-slate-400" htmlFor="action-status">
              Status
            </label>
            <select
              id="action-status"
              className={selectBase}
              value={actionForm.status}
              onChange={(event) =>
                setActionForm({
                  ...actionForm,
                  status: event.target.value as ActionFormState["status"]
                })
              }
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
            <p className="text-xs text-slate-500">
              disabled는 생성 후 즉시 호출이 차단됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">권한 설정</p>
            <p className="text-xs text-slate-500">액션을 호출할 수 있는 역할을 선택하세요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setActionForm({
                  ...actionForm,
                  roleIds: roleOptions.map((role) => role.id)
                })
              }
              disabled={roleOptions.length === 0}
            >
              모두 선택
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setActionForm({ ...actionForm, roleIds: [] })}
              disabled={actionForm.roleIds.length === 0}
            >
              선택 해제
            </Button>
          </div>
        </div>
        {roleOptions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            역할이 없습니다. 먼저 Roles 탭에서 역할을 생성하세요.
          </p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
            {roleOptions.map((role) => {
              const selected = actionForm.roleIds.includes(role.id);
              return (
                <label
                  key={role.id}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                    selected
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-slate-800 bg-slate-950/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-400"
                    checked={selected}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...actionForm.roleIds, role.id]
                        : actionForm.roleIds.filter((id) => id !== role.id);
                      setActionForm({ ...actionForm, roleIds: next });
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">{role.id}</span>
                    <span>{role.name}</span>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-100">Home Assistant 호출</p>
            <p className="text-xs text-slate-500">
              하나의 액션에 여러 HA 서비스를 순차적으로 실행할 수 있습니다.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setActionForm({
                ...actionForm,
                calls: [...actionForm.calls, { domain: "", service: "", entityIds: [], data: "" }]
              })
            }
          >
            + 호출 추가
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {actionForm.calls.map((call, index) => {
            const servicesForDomain = call.domain ? serviceMap.get(call.domain.trim()) ?? [] : [];
            const entitiesForDomain = call.domain ? entityMap.get(call.domain.trim()) ?? [] : [];
            const summaryParts = [];
            if (call.domain && call.service) summaryParts.push(`${call.domain}.${call.service}`);
            if (call.entityIds.length > 0) summaryParts.push(`엔티티 ${call.entityIds.length}`);

            return (
              <div
                key={`call-${index}`}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">Call {index + 1}</p>
                    <p className="text-xs text-slate-500">
                      {summaryParts.length > 0
                        ? `요약: ${summaryParts.join(" · ")}`
                        : "도메인과 서비스를 선택하세요."}
                    </p>
                  </div>
                  {actionForm.calls.length > 1 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const next = actionForm.calls.filter((_, i) => i !== index);
                        setActionForm({ ...actionForm, calls: next });
                      }}
                    >
                      호출 삭제
                    </Button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-400">Domain</label>
                    <select
                      className={selectBase}
                      value={call.domain}
                      onChange={(event) => {
                        const next = [...actionForm.calls];
                        next[index] = { ...next[index], domain: event.target.value, service: "" };
                        setActionForm({ ...actionForm, calls: next });
                      }}
                    >
                      <option value="">도메인 선택</option>
                      {[...serviceMap.keys()].map((domain) => (
                        <option key={domain} value={domain}>
                          {domain}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">목록에 없으면 Advanced에서 직접 입력.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-400">Service</label>
                    <select
                      className={selectBase}
                      value={call.service}
                      onChange={(event) => {
                        const next = [...actionForm.calls];
                        next[index] = { ...next[index], service: event.target.value };
                        setActionForm({ ...actionForm, calls: next });
                      }}
                      disabled={!call.domain}
                    >
                      <option value="">서비스 선택</option>
                      {servicesForDomain.map((service) => (
                        <option key={service} value={service}>
                          {service}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      도메인 선택 후 가능한 서비스가 표시됩니다.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase text-slate-400">Entities (선택)</label>
                    <select
                      multiple
                      className={multiSelectBase}
                      value={call.entityIds}
                      onChange={(event) => {
                        const selected = Array.from(event.target.selectedOptions).map(
                          (option) => option.value
                        );
                        const next = [...actionForm.calls];
                        next[index] = { ...next[index], entityIds: selected };
                        setActionForm({ ...actionForm, calls: next });
                      }}
                      disabled={!call.domain}
                    >
                      {entitiesForDomain.length === 0 ? (
                        <option value="" disabled>
                          {call.domain ? "엔티티 없음" : "도메인 먼저 선택"}
                        </option>
                      ) : null}
                      {entitiesForDomain.map((entity) => (
                        <option key={entity.entityId} value={entity.entityId}>
                          {entity.name} ({entity.entityId})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      엔티티가 필요 없는 서비스라면 비워둬도 됩니다.
                    </p>
                  </div>
                </div>

                <details className="mt-4 rounded-md border border-slate-800 bg-slate-900/40 p-3">
                  <summary className="cursor-pointer text-xs uppercase text-slate-400">
                    고급 입력
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs uppercase text-slate-400">Domain (직접 입력)</label>
                      <Input
                        placeholder="domain"
                        value={call.domain}
                        onChange={(event) => {
                          const next = [...actionForm.calls];
                          next[index] = { ...next[index], domain: event.target.value };
                          setActionForm({ ...actionForm, calls: next });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase text-slate-400">Service (직접 입력)</label>
                      <Input
                        placeholder="service"
                        value={call.service}
                        onChange={(event) => {
                          const next = [...actionForm.calls];
                          next[index] = { ...next[index], service: event.target.value };
                          setActionForm({ ...actionForm, calls: next });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase text-slate-400">
                        Entity ID(s) 직접 입력
                      </label>
                      <Input
                        placeholder="entity_id, entity_id"
                        value={call.entityIds.join(", ")}
                        onChange={(event) => {
                          const next = [...actionForm.calls];
                          const parsed = event.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean);
                          next[index] = { ...next[index], entityIds: parsed };
                          setActionForm({ ...actionForm, calls: next });
                        }}
                      />
                    </div>
                  </div>
                </details>

                <div className="mt-4 space-y-2">
                  <label className="text-xs uppercase text-slate-400">
                    서비스 데이터 JSON (선택)
                  </label>
                  <p className="text-xs text-slate-500">
                    HA 서비스 데이터. 예: {"{ \"brightness\": 120 }"}
                  </p>
                  <Textarea
                    placeholder='{"brightness":120}'
                    value={call.data}
                    onChange={(event) => {
                      const next = [...actionForm.calls];
                      next[index] = { ...next[index], data: event.target.value };
                      setActionForm({ ...actionForm, calls: next });
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div>
          <p className="text-sm font-medium text-slate-100">액션 생성 준비</p>
          <p className="text-xs text-slate-500">
            ID, Name, Role을 입력하면 생성 버튼이 활성화됩니다.
          </p>
        </div>
        <Button onClick={onCreate} disabled={isDisabled}>
          액션 생성
        </Button>
      </div>
    </div>
  );
}
