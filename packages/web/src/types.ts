export type ActionCallForm = {
  domain: string;
  service: string;
  entityIds: string[];
  data: string;
};

export type ActionFormState = {
  id: string;
  name: string;
  description: string;
  status: "active" | "disabled";
  roleIds: string[];
  calls: ActionCallForm[];
};

export type ClientFormState = {
  name: string;
  roleId: string;
  status: "active" | "disabled";
};
