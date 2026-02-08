import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

export function LoginCard({
  password,
  onPasswordChange,
  onSubmit,
  isSubmitting,
  hasError
}: {
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  hasError: boolean;
}) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-2xl">ha-gatekeeper admin</CardTitle>
        <p className="text-sm text-slate-400">세션 기반 관리 콘솔 로그인</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
        <Button className="w-full" onClick={onSubmit} disabled={isSubmitting}>
          로그인
        </Button>
        {hasError ? <p className="text-sm text-rose-300">로그인 실패. 비밀번호를 확인하세요.</p> : null}
      </CardContent>
    </Card>
  );
}
