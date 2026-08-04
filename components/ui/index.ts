/**
 * Design System do portal.
 *
 * Ponto unico de importacao: `import { Button, Card, Input } from "@/components/ui"`.
 * Assim uma mudanca de arquivo nao obriga a caçar imports por todo o projeto.
 *
 * Sidebar e Menu ficaram de fora ate a navegacao existir, e agora que ela
 * existe eles moraram em `components/dashboard/` — nao aqui. O criterio e o que
 * separa este diretorio do resto: aqui ficam pecas que nao sabem nada sobre o
 * sistema (um `Button` serve a qualquer tela), enquanto a Sidebar conhece o
 * MENU, as rotas e a rota ativa. Trazer isso para ca amarraria o Design System
 * a navegacao do portal.
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
