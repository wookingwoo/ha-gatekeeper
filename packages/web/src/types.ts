import type { QuickSetupUseCase } from "./api";

export type ActionCallForm = {
  domain: string;
  service: string;
  entityIds: string[];
  allowNoEntity: boolean;
};

export type ActionFormState = {
  id: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  roleIds: string[];
  call: ActionCallForm;
};

export type ClientFormState = {
  name: string;
  roleId: string;
  status: "active" | "disabled";
};

export type QuickSetupStep = "use-case" | "targets" | "review" | "issued";

export type QuickSetupState = {
  step: QuickSetupStep;
  useCase: QuickSetupUseCase | "";
  targetEntityIds: string[];
  tokenName: string;
};
