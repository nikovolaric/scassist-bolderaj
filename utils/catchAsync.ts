import { NextFunction, Request, Response } from "express";

export default function (fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
