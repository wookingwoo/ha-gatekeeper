import { Role } from "../api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export function RoleTable({ roles }: { roles: Role[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Name</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((role) => (
          <TableRow key={role.id}>
            <TableCell className="font-mono text-xs text-slate-400">{role.id}</TableCell>
            <TableCell>{role.name}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
