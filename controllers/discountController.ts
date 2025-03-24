import Discount from "../models/discountModel";
import {
  createOne,
  deleteOne,
  getAll,
  getOne,
  updateOne,
} from "./handlerFactory";

export const createDiscount = createOne(Discount);
export const getAllDiscounts = getAll(Discount);
export const getOneDiscount = getOne(Discount);
export const updateDiscount = updateOne(Discount);
export const deleteDiscount = deleteOne(Discount);
