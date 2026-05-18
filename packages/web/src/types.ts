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
