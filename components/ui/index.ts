/**
 * Design System do portal.
 *
 * Ponto unico de importacao: `import { Button, Card, Input } from "@/components/ui"`.
 * Assim uma mudanca de arquivo nao obriga a caçar imports por todo o projeto.
 *
 * Sidebar e Menu NAO estao aqui de proposito. Eles dependem da navegacao e da
 * hierarquia de permissoes, que so ficam definidas na Fase 04 — construi-los
 * agora seria adivinhar, e adivinhacao em componente compartilhado e o tipo de
 * coisa que depois ninguem consegue mudar.
 */
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Checkbox } from "./checkbox";
export { Input, type InputProps } from "./input";
export { Badge, badgeVariants } from "./badge";
export { Alert } from "./alert";
export { Skeleton } from "./skeleton";
export {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
} from "./card";
export {
  Table, TableHead, TableBody, TableRow, TableTh, TableTd,
} from "./table";
export {
  Dialog, DialogTrigger, DialogClose, DialogContent,
  DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./dialog";
