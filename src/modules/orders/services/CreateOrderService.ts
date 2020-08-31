import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

interface IOrderProduct {
  product_id: string;
  price: number;
  quantity: number;
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository') private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer not found');
    }

    const productIds = products.map(product => ({
      id: product.id,
    }));
    const foundProducts = await this.productsRepository.findAllById(productIds);

    const orderProducts: IOrderProduct[] = [];
    const updateQuantityProducts: IProduct[] = [];
    const notFoundProducts: IProduct[] = [];
    const insufficientQuantityProducts: IProduct[] = [];

    products.forEach(element => {
      const foundProduct = foundProducts.find(
        product => product.id === element.id,
      );
      if (foundProduct) {
        if (element.quantity <= foundProduct.quantity) {
          orderProducts.push({
            product_id: element.id,
            price: foundProduct.price,
            quantity: element.quantity,
          });
          updateQuantityProducts.push({
            id: element.id,
            quantity: foundProduct.quantity - element.quantity,
          });
        } else {
          insufficientQuantityProducts.push(element);
        }
      } else {
        notFoundProducts.push(element);
      }
    });

    if (notFoundProducts.length) {
      throw new AppError('Products not found');
    }

    if (insufficientQuantityProducts.length) {
      throw new AppError('Products wiith insufficient quantities');
    }

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(updateQuantityProducts);

    return order;
  }
}

export default CreateOrderService;
