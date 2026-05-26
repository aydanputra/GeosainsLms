import { prisma } from '@/utils/prisma';
import { z } from 'zod';
import { Prisma, OrderStatus } from '@prisma/client';

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

// Schemas
export const ProductSchema = z.object({
  name: z.string().min(3),
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  type: z.enum(['PHYSICAL', 'SERVICE', 'RENTAL']).optional(),
  price: z.number().min(0),
  stock: z.number().int().min(0),
  category: z.enum(['BOOKS', 'MERCH', 'OTHER']).optional(),
  categoryId: z.string().optional().nullable(),
  categoryIds: z.array(z.string()).optional().nullable(),
  vendorId: z.string().optional().nullable(),
  imageUrl: z
    .string()
    .trim()
    .refine((v) => v === '' || v.startsWith('/') || isHttpUrl(v), { message: 'URL gambar tidak valid' })
    .optional()
    .nullable(),
  imageUrls: z
    .array(z.string().trim().refine((v) => v === '' || v.startsWith('/') || isHttpUrl(v), { message: 'URL gambar tidak valid' }))
    .max(4)
    .optional()
    .nullable(),
});

export const OrderItemSchema = z.object({
  productId: z.string().optional(),
  courseId: z.string().optional(),
  subscriptionPlan: z.enum(['MONTHLY', 'YEARLY']).optional(),
  quantity: z.number().int().min(1),
  meta: z.unknown().optional(),
});

export const ShippingSchema = z
  .object({
    recipientName: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    addressLine1: z.string().trim().min(5).max(200),
    addressLine2: z.string().trim().max(200).optional().nullable(),
    city: z.string().trim().min(2).max(120),
    province: z.string().trim().max(120).optional().nullable(),
    postalCode: z.string().trim().max(20).optional().nullable(),
    country: z.string().trim().max(80).optional().nullable(),
    note: z.string().trim().max(300).optional().nullable(),
  })
  .strict();

export const CreateOrderSchema = z.object({
  items: z.array(OrderItemSchema),
  couponCode: z.string().trim().optional(),
  discountTotal: z.number().min(0).optional(),
  shipping: ShippingSchema.optional().nullable(),
});

// Product Services
export const createProduct = async (data: z.infer<typeof ProductSchema>) => {
  const categoryIds = Array.isArray((data as any).categoryIds)
    ? (data as any).categoryIds.map((v: any) => String(v || '').trim()).filter(Boolean)
    : [];
  const categoryId = typeof data.categoryId === 'string' ? data.categoryId.trim() : '';
  const normalizedCategoryId = categoryId || (categoryIds.length > 0 ? categoryIds[0] : null);
  const normalizedCategoryIds = categoryIds.length > 0 ? categoryIds : normalizedCategoryId ? [normalizedCategoryId] : [];

  const payload: Prisma.ProductUncheckedCreateInput = {
    name: data.name,
    slug: data.slug ?? null,
    description: data.description ?? null,
    type: data.type ?? 'PHYSICAL',
    price: data.price,
    stock: data.stock,
    category: data.category ?? 'OTHER',
    categoryId: normalizedCategoryId,
    categoryIds: normalizedCategoryIds,
    vendorId: data.vendorId ?? null,
    imageUrl: data.imageUrl ?? null,
    imageUrls: data.imageUrls ?? [],
  };

  return prisma.product.create({
    data: payload,
    include: { categoryRef: true, vendor: true },
  });
};

export const getProducts = async () => {
  return prisma.product.findMany({
    include: { categoryRef: true, vendor: true },
    orderBy: { createdAt: 'desc' },
  });
};

export const getProductById = async (id: string) => {
  return prisma.product.findUnique({
    where: { id },
    include: { categoryRef: true, vendor: true },
  });
};

export const updateProduct = async (id: string, data: Partial<z.infer<typeof ProductSchema>>) => {
  const payload: Prisma.ProductUncheckedUpdateInput = {};
  if (typeof data.name === 'string') payload.name = data.name;
  if (data.slug !== undefined) payload.slug = data.slug;
  if (data.description !== undefined) payload.description = data.description;
  if (data.type !== undefined) payload.type = data.type || 'PHYSICAL';
  if (typeof data.price === 'number') payload.price = data.price;
  if (typeof data.stock === 'number') payload.stock = data.stock;
  if (data.category !== undefined) payload.category = data.category;
  if (data.categoryIds !== undefined) {
    const list = Array.isArray(data.categoryIds) ? data.categoryIds.map((v) => String(v || '').trim()).filter(Boolean) : [];
    payload.categoryIds = list;
    if (list.length > 0 && data.categoryId === undefined) payload.categoryId = list[0];
    if (list.length === 0 && data.categoryId === undefined) payload.categoryId = null;
  }
  if (data.categoryId !== undefined) {
    payload.categoryId = data.categoryId;
    if (data.categoryId) payload.categoryIds = [String(data.categoryId)];
    else if (data.categoryIds === undefined) payload.categoryIds = [];
  }
  if (data.vendorId !== undefined) payload.vendorId = data.vendorId;
  if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
  if (data.imageUrls !== undefined) payload.imageUrls = data.imageUrls || [];

  return prisma.product.update({
    where: { id },
    data: payload,
    include: { categoryRef: true, vendor: true },
  });
};

export const deleteProduct = async (id: string) => {
  return prisma.product.delete({
    where: { id },
  });
};

// Order Services
export const createOrder = async (
  userId: string,
  input: z.infer<typeof CreateOrderSchema>,
  opts?: { allowManualDiscount?: boolean; checkoutUniqueCode?: number | null; affiliateCode?: string | null; affiliateReferralId?: string | null }
) => {
  const parsed = CreateOrderSchema.parse(input);
  const items = parsed.items;
  const discountTotal = Number.isFinite(parsed.discountTotal) ? Number(parsed.discountTotal) : 0;
  const couponCode =
    typeof parsed.couponCode === 'string'
      ? parsed.couponCode.trim().toUpperCase().replace(/\s+/g, '')
      : '';

  const affiliateCodeRaw = typeof opts?.affiliateCode === 'string' ? opts.affiliateCode.trim().toUpperCase().replace(/\s+/g, '') : '';
  const affiliateProfile =
    affiliateCodeRaw && affiliateCodeRaw.length <= 32
      ? await prisma.affiliateProfile.findUnique({ where: { code: affiliateCodeRaw }, select: { userId: true } })
      : null;
  const affiliateCode = affiliateProfile && String(affiliateProfile.userId) !== String(userId) ? affiliateCodeRaw : '';

  const affiliateReferralIdRaw = typeof opts?.affiliateReferralId === 'string' ? String(opts.affiliateReferralId).trim() : '';
  const affiliateReferralIdCandidate = affiliateReferralIdRaw && affiliateReferralIdRaw.length <= 64 ? affiliateReferralIdRaw : '';
  const affiliateReferral =
    affiliateCode && affiliateReferralIdCandidate
      ? await prisma.referral.findUnique({
          where: { id: affiliateReferralIdCandidate },
          select: {
            id: true,
            userId: true,
            affiliate: { select: { code: true, userId: true } },
          },
        })
      : null;
  const affiliateReferralId =
    affiliateReferral &&
    String(affiliateReferral.affiliate.code || '').trim().toUpperCase().replace(/\s+/g, '') === affiliateCode &&
    String(affiliateReferral.affiliate.userId) !== String(userId) &&
    (!affiliateReferral.userId || String(affiliateReferral.userId) === String(userId))
      ? affiliateReferral.id
      : null;

  const toDate = (value: unknown) => {
    const s = typeof value === 'string' ? value.trim() : '';
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  };

  const toString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

  const safeParseSettings = (content: string | null | undefined) => {
    if (!content) return {};
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const toMoney = (v: unknown) => {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    return Number.isFinite(n) ? Math.max(0, n) : null;
  };

  const siteSettingsPage = await prisma.page.findUnique({ where: { slug: '__site_settings__' }, select: { content: true } });
  const settings = safeParseSettings(siteSettingsPage?.content);
  const subscriptionMonthlyPrice = toMoney((settings as any).subscriptionMonthlyPrice) ?? 99000;
  const subscriptionYearlyPrice = toMoney((settings as any).subscriptionYearlyPrice) ?? 990000;

  let subtotal = 0;
  let hasPhysical = false;
  let hasCourse = false;
  let hasSubscription = false;
  const orderItemsData: Array<{
    productId?: string;
    courseId?: string;
    quantity: number;
    price: number;
    meta?: any;
    discountAmount: number;
    discountStoreAmount: number;
    discountMarketplaceAmount: number;
    refundAmount: number;
  }> = [];
  const itemRefs: Array<{
    productVendorId?: string | null;
    productCategoryId?: string | null;
    productCategoryIds?: string[];
    courseCategoryId?: string | null;
    courseCategoryIds?: string[];
  }> = [];

  for (const item of items) {
    let unitPrice = 0;
    let meta: any = Prisma.DbNull;

    if (item.productId) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, price: true, stock: true, type: true, vendorId: true, categoryId: true, categoryIds: true },
      });
      if (!product) throw new Error(`Product ${item.productId} not found`);

      const productType = product.type;
      if (productType === 'PHYSICAL') {
        hasPhysical = true;
        if (product.stock < item.quantity) throw new Error(`Insufficient stock for product ${product.name}`);
        unitPrice = product.price;
      } else if (productType === 'SERVICE') {
        if (item.quantity !== 1) throw new Error('Jasa hanya bisa dipesan dengan quantity 1 per item');
        const raw = (item as any).meta;
        const service = raw && typeof raw === 'object' ? (raw as any).service : null;
        const start = toDate(service?.start);
        const end = toDate(service?.end);
        if (!start || !end) throw new Error('Jadwal jasa wajib diisi');
        if (end.getTime() <= start.getTime()) throw new Error('Jadwal jasa tidak valid');
        unitPrice = product.price;
        meta = {
          service: {
            start: start.toISOString(),
            end: end.toISOString(),
            locationAddress: toString(service?.locationAddress) || null,
            note: toString(service?.note) || null,
          },
        };
      } else if (productType === 'RENTAL') {
        const raw = (item as any).meta;
        const rental = raw && typeof raw === 'object' ? (raw as any).rental : null;
        const start = toDate(rental?.start);
        const end = toDate(rental?.end);
        if (!start || !end) throw new Error('Periode sewa wajib diisi');
        if (end.getTime() <= start.getTime()) throw new Error('Periode sewa tidak valid');
        if (product.stock <= 0) throw new Error('Stok alat sewa tidak tersedia');

        const ms = end.getTime() - start.getTime();
        const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
        unitPrice = product.price * days;

        const pickupMethodRaw = toString(rental?.pickupMethod).toUpperCase();
        const pickupMethod = pickupMethodRaw === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';
        const delivery = pickupMethod === 'DELIVERY' ? rental?.deliveryAddress : null;
        const deliveryLine1 = toString(delivery?.addressLine1);
        const deliveryCity = toString(delivery?.city);
        if (pickupMethod === 'DELIVERY' && (!deliveryLine1 || !deliveryCity)) {
          throw new Error('Alamat pengantaran wajib diisi untuk sewa dengan delivery');
        }

        const reservedAgg = await prisma.rentalReservation.aggregate({
          where: {
            productId: product.id,
            status: { in: ['REQUESTED', 'APPROVED', 'ACTIVE'] },
            startDate: { lt: end },
            endDate: { gt: start },
          },
          _sum: { quantity: true },
        });
        const reservedQty = Number(reservedAgg._sum.quantity || 0);
        if (reservedQty + item.quantity > product.stock) {
          throw new Error('Alat tidak tersedia pada periode sewa yang dipilih');
        }

        meta = {
          rental: {
            start: start.toISOString(),
            end: end.toISOString(),
            days,
            pickupMethod,
            deliveryAddress:
              pickupMethod === 'DELIVERY'
                ? {
                    addressLine1: deliveryLine1,
                    addressLine2: toString(delivery?.addressLine2) || null,
                    city: deliveryCity,
                    province: toString(delivery?.province) || null,
                    postalCode: toString(delivery?.postalCode) || null,
                    country: toString(delivery?.country) || null,
                  }
                : null,
            note: toString(rental?.note) || null,
          },
        };
      } else {
        throw new Error('Product type not supported');
      }

      orderItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        price: unitPrice,
        meta,
        discountAmount: 0,
        discountStoreAmount: 0,
        discountMarketplaceAmount: 0,
        refundAmount: 0,
      });
      itemRefs.push({
        productVendorId: product.vendorId ?? null,
        productCategoryId: product.categoryId ?? null,
        productCategoryIds: Array.isArray((product as any).categoryIds) ? (product as any).categoryIds.map(String).filter(Boolean) : [],
      });
      subtotal += unitPrice * item.quantity;
      continue;
    }

    if (item.courseId) {
      const course = await prisma.course.findUnique({ where: { id: item.courseId }, select: { id: true, price: true, categoryId: true, categoryIds: true } });
      if (!course) throw new Error(`Course ${item.courseId} not found`);
      unitPrice = course.price;
      hasCourse = true;
      orderItemsData.push({
        courseId: item.courseId,
        quantity: item.quantity,
        price: unitPrice,
        meta: Prisma.DbNull,
        discountAmount: 0,
        discountStoreAmount: 0,
        discountMarketplaceAmount: 0,
        refundAmount: 0,
      });
      itemRefs.push({
        courseCategoryId: course.categoryId ?? null,
        courseCategoryIds: Array.isArray((course as any).categoryIds) ? (course as any).categoryIds.map(String).filter(Boolean) : [],
      });
      subtotal += unitPrice * item.quantity;
      continue;
    }

    if ((item as any).subscriptionPlan) {
      const planRaw = String((item as any).subscriptionPlan || '').trim().toUpperCase();
      const plan = planRaw === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
      if (item.quantity !== 1) throw new Error('Langganan hanya bisa dipesan dengan quantity 1 per item');
      const durationDays = plan === 'YEARLY' ? 365 : 30;
      unitPrice = plan === 'YEARLY' ? subscriptionYearlyPrice : subscriptionMonthlyPrice;
      hasSubscription = true;
      meta = { subscription: { plan, durationDays } };
      orderItemsData.push({
        quantity: item.quantity,
        price: unitPrice,
        meta,
        discountAmount: 0,
        discountStoreAmount: 0,
        discountMarketplaceAmount: 0,
        refundAmount: 0,
      });
      itemRefs.push({});
      subtotal += unitPrice * item.quantity;
      continue;
    }

    throw new Error('Item must have productId or courseId or subscriptionPlan');
  }

  const shipping = parsed.shipping || null;
  if (hasPhysical && !shipping) {
    throw new Error('Alamat pengiriman wajib diisi untuk pembelian produk fisik');
  }

  const now = new Date();
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let couponId: string | null = null;
  let normalizedDiscount = 0;
  let discountMarketplaceShare = 0;
  let discountMarketplaceTotal = 0;
  let discountStoreTotal = 0;

  if (hasSubscription && couponCode) {
    throw new Error('Kupon tidak berlaku untuk pembelian langganan');
  }

  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
    if (!coupon || !coupon.isActive) throw new Error('Kupon tidak valid');
    if (coupon.startsAt && coupon.startsAt > now) throw new Error('Kupon belum berlaku');
    if (coupon.expiresAt && coupon.expiresAt <= now) throw new Error('Kupon sudah kedaluwarsa');
    if (
      typeof coupon.maxRedemptions === 'number' &&
      Number.isFinite(coupon.maxRedemptions) &&
      coupon.maxRedemptions !== null &&
      coupon.redeemedCount >= coupon.maxRedemptions
    ) {
      throw new Error('Kupon sudah mencapai batas penggunaan');
    }

    const scope = String((coupon as any).scope || 'ALL').toUpperCase();
    const courseIds = new Set<string>(Array.isArray((coupon as any).courseIds) ? (coupon as any).courseIds.map(String) : []);
    const productIds = new Set<string>(Array.isArray((coupon as any).productIds) ? (coupon as any).productIds.map(String) : []);
    const vendorIds = new Set<string>(Array.isArray((coupon as any).vendorIds) ? (coupon as any).vendorIds.map(String) : []);
    const courseCategoryIds = new Set<string>(Array.isArray((coupon as any).courseCategoryIds) ? (coupon as any).courseCategoryIds.map(String) : []);
    const productCategoryIds = new Set<string>(Array.isArray((coupon as any).productCategoryIds) ? (coupon as any).productCategoryIds.map(String) : []);

    const isEligible = (idx: number) => {
      const it: any = orderItemsData[idx];
      const ref = itemRefs[idx] || {};
      if (!it) return false;

      if (scope === 'ALL') return true;

      if (scope === 'COURSES') return Boolean(it.courseId) && courseIds.has(String(it.courseId));
      if (scope === 'PRODUCTS') return Boolean(it.productId) && productIds.has(String(it.productId));

      if (scope === 'VENDORS') {
        const vid = ref.productVendorId || null;
        return Boolean(it.productId) && Boolean(vid) && vendorIds.has(String(vid));
      }

      if (scope === 'COURSE_CATEGORIES') {
        const cids: string[] = Array.isArray((ref as any).courseCategoryIds) ? (ref as any).courseCategoryIds.map(String).filter(Boolean) : [];
        if (cids.length > 0) return Boolean(it.courseId) && cids.some((cid) => courseCategoryIds.has(String(cid)));
        const cid = ref.courseCategoryId || null;
        return Boolean(it.courseId) && Boolean(cid) && courseCategoryIds.has(String(cid));
      }

      if (scope === 'PRODUCT_CATEGORIES') {
        const cids: string[] = Array.isArray((ref as any).productCategoryIds) ? (ref as any).productCategoryIds.map(String).filter(Boolean) : [];
        if (cids.length > 0) return Boolean(it.productId) && cids.some((cid) => productCategoryIds.has(String(cid)));
        const cid = ref.productCategoryId || null;
        return Boolean(it.productId) && Boolean(cid) && productCategoryIds.has(String(cid));
      }

      return true;
    };

    const lineSubtotals = orderItemsData.map((it) => it.price * it.quantity);
    const eligibleIndices = orderItemsData.map((_it, i) => i).filter((i) => isEligible(i));
    const eligibleSubtotal = eligibleIndices.reduce((sum, i) => sum + (lineSubtotals[i] || 0), 0);

    if (eligibleSubtotal <= 0) throw new Error('Kupon tidak berlaku untuk item di keranjang ini');
    if (typeof coupon.minSubtotal === 'number' && Number.isFinite(coupon.minSubtotal) && eligibleSubtotal < coupon.minSubtotal) {
      throw new Error('Subtotal item yang memenuhi syarat belum mencukupi untuk kupon ini');
    }

    const discountRaw = coupon.type === 'PERCENT' ? (eligibleSubtotal * Number(coupon.amount || 0)) / 100 : Number(coupon.amount || 0);
    const maxDiscount = typeof (coupon as any).maxDiscount === 'number' && Number.isFinite((coupon as any).maxDiscount) ? Number((coupon as any).maxDiscount) : null;
    const boundedRaw = maxDiscount !== null ? Math.min(discountRaw, maxDiscount) : discountRaw;
    normalizedDiscount = Math.max(0, Math.min(eligibleSubtotal, round2(boundedRaw)));
    couponId = coupon.id;

    const funding = String((coupon as any).funding || 'STORE').toUpperCase();
    const mpPct = Number((coupon as any).marketplaceSharePercent || 0);
    if (funding === 'MARKETPLACE') discountMarketplaceShare = 1;
    else if (funding === 'SPLIT') discountMarketplaceShare = Math.max(0, Math.min(1, mpPct / 100));
    else discountMarketplaceShare = 0;

    const usageLimitPerUser = typeof (coupon as any).usageLimitPerUser === 'number' && Number.isFinite((coupon as any).usageLimitPerUser) ? Math.trunc(Number((coupon as any).usageLimitPerUser)) : null;
    if (usageLimitPerUser && usageLimitPerUser > 0) {
      const usedCount = await prisma.couponRedemption.count({
        where: {
          couponId: coupon.id,
          userId,
          order: { status: { in: ['PENDING', 'PAID', 'SHIPPED'] } },
        },
      });
      if (usedCount >= usageLimitPerUser) throw new Error('Kupon sudah mencapai batas penggunaan untuk akun Anda');
    }

    if (normalizedDiscount > 0 && eligibleIndices.length > 0) {
      const totalMarketplace = round2(normalizedDiscount * discountMarketplaceShare);
      const totalStore = round2(normalizedDiscount - totalMarketplace);
      discountMarketplaceTotal = totalMarketplace;
      discountStoreTotal = totalStore;

      let remaining = normalizedDiscount;
      let remainingMarketplace = totalMarketplace;
      let remainingStore = totalStore;
      const lastEligibleIndex = eligibleIndices[eligibleIndices.length - 1];
      for (const i of eligibleIndices) {
        const lineSubtotal = lineSubtotals[i] || 0;
        const allocTotal = i === lastEligibleIndex ? remaining : round2((normalizedDiscount * lineSubtotal) / eligibleSubtotal);
        const boundedTotal = Math.max(0, Math.min(lineSubtotal, allocTotal));

        const allocMarketplace = i === lastEligibleIndex ? remainingMarketplace : round2((totalMarketplace * lineSubtotal) / eligibleSubtotal);
        const boundedMarketplace = Math.max(0, Math.min(boundedTotal, allocMarketplace));
        const boundedStore = round2(boundedTotal - boundedMarketplace);

        orderItemsData[i].discountAmount = boundedTotal;
        orderItemsData[i].discountMarketplaceAmount = boundedMarketplace;
        orderItemsData[i].discountStoreAmount = boundedStore;

        remaining = round2(remaining - boundedTotal);
        remainingMarketplace = round2(remainingMarketplace - boundedMarketplace);
        remainingStore = round2(remainingStore - boundedStore);
      }
    }
  } else if (opts?.allowManualDiscount) {
    normalizedDiscount = Math.max(0, Math.min(subtotal, round2(discountTotal)));
    discountMarketplaceShare = 0;
    discountMarketplaceTotal = 0;
    discountStoreTotal = normalizedDiscount;

    if (normalizedDiscount > 0 && subtotal > 0 && orderItemsData.length > 0) {
      let remaining = normalizedDiscount;
      const subtotals = orderItemsData.map((it) => it.price * it.quantity);
      const lastIndex = orderItemsData.length - 1;
      for (let i = 0; i < orderItemsData.length; i++) {
        const lineSubtotal = subtotals[i] || 0;
        const alloc = i === lastIndex ? remaining : round2((normalizedDiscount * lineSubtotal) / subtotal);
        const bounded = Math.max(0, Math.min(lineSubtotal, alloc));
        orderItemsData[i].discountAmount = bounded;
        orderItemsData[i].discountStoreAmount = bounded;
        orderItemsData[i].discountMarketplaceAmount = 0;
        remaining = round2(remaining - bounded);
      }
    }
  }

  const safeParse = (content: string | null | undefined) => {
    if (!content) return {};
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  };

  const settingsPage = await prisma.page.findUnique({ where: { slug: '__course_settings__' }, select: { content: true } });
  const courseSettings = safeParse(settingsPage?.content);
  const checkoutServiceFeeEnabled = courseSettings['checkoutServiceFeeEnabled'] === true;
  const checkoutServiceFeeAmountRaw = Number(courseSettings['checkoutServiceFeeAmount']);
  const checkoutServiceFeeAmount = Number.isFinite(checkoutServiceFeeAmountRaw) ? Math.max(0, Math.round(checkoutServiceFeeAmountRaw)) : 0;
  const checkoutUniqueCodeEnabled = courseSettings['checkoutUniqueCodeEnabled'] === true;
  const uniqueDigitsRaw = Number(courseSettings['checkoutUniqueCodeDigits']);
  const checkoutUniqueCodeDigits = Number.isFinite(uniqueDigitsRaw) ? Math.min(3, Math.max(1, Math.floor(uniqueDigitsRaw))) : 3;

  const baseAmount = Math.max(0, Math.round(subtotal - normalizedDiscount));
  const serviceFee = baseAmount > 0 && hasCourse && checkoutServiceFeeEnabled ? checkoutServiceFeeAmount : 0;
  const baseWithFee = baseAmount + serviceFee;

  let uniqueCode = 0;
  if (baseWithFee > 0 && hasCourse && checkoutUniqueCodeEnabled) {
    const max = Math.pow(10, checkoutUniqueCodeDigits) - 1;
    const overrideRaw = typeof opts?.checkoutUniqueCode === 'number' ? Math.floor(opts.checkoutUniqueCode) : 0;
    const candidate = overrideRaw >= 1 && overrideRaw <= max ? overrideRaw : Math.floor(Math.random() * max) + 1;
    uniqueCode = Math.min(candidate, Math.max(0, baseWithFee - 1));
  }

  const total = baseWithFee - uniqueCode;
  const expiryMinutesRaw = Number(process.env.PAYMENT_EXPIRY_MINUTES || process.env.ORDER_PAYMENT_EXPIRY_MINUTES || 60);
  const expiryMinutes = Number.isFinite(expiryMinutesRaw) && expiryMinutesRaw > 0 ? Math.min(7 * 24 * 60, Math.floor(expiryMinutesRaw)) : 60;
  const paymentDueAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        subtotal,
        discountTotal: normalizedDiscount,
        discountStoreTotal,
        discountMarketplaceTotal,
        serviceFee,
        uniqueCode,
        total,
        refundTotal: 0,
        status: 'PENDING',
        paymentDueAt,
        affiliateCode: affiliateCode || null,
        affiliateReferralId,
        couponId,
        ...(hasPhysical && shipping
          ? {
              shippingRecipientName: shipping.recipientName,
              shippingPhone: shipping.phone,
              shippingAddressLine1: shipping.addressLine1,
              shippingAddressLine2: shipping.addressLine2 ?? null,
              shippingCity: shipping.city,
              shippingProvince: shipping.province ?? null,
              shippingPostalCode: shipping.postalCode ?? null,
              shippingCountry: shipping.country ?? null,
            }
          : {}),
        items: {
          create: orderItemsData,
        },
      },
      include: {
        items: {
          include: {
            product: true,
            course: true,
            serviceBooking: true,
            rentalReservation: true,
          },
        },
      },
    });

    if (couponId) {
      await tx.coupon.update({ where: { id: couponId }, data: { redeemedCount: { increment: 1 } } });
      await tx.couponRedemption.create({
        data: {
          couponId,
          userId,
          orderId: created.id,
        },
      });
    }

    for (const it of created.items) {
      if (!it.productId || !it.product) continue;
      if (it.product.type === 'SERVICE') {
        const m: any = (it as any).meta;
        const svc = m && typeof m === 'object' ? m.service : null;
        const start = toDate(svc?.start);
        const end = toDate(svc?.end);
        if (!start || !end) continue;
        await tx.serviceBooking.create({
          data: {
            orderItemId: it.id,
            productId: String(it.productId),
            userId,
            scheduledStart: start,
            scheduledEnd: end,
            locationAddress: toString(svc?.locationAddress) || null,
            note: toString(svc?.note) || null,
            status: 'REQUESTED',
          },
        });
      }
      if (it.product.type === 'RENTAL') {
        const m: any = (it as any).meta;
        const r = m && typeof m === 'object' ? m.rental : null;
        const start = toDate(r?.start);
        const end = toDate(r?.end);
        if (!start || !end) continue;
        const pickupMethod = toString(r?.pickupMethod).toUpperCase() === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';
        const da = pickupMethod === 'DELIVERY' ? r?.deliveryAddress : null;
        await tx.rentalReservation.create({
          data: {
            orderItemId: it.id,
            productId: String(it.productId),
            userId,
            startDate: start,
            endDate: end,
            quantity: Number(it.quantity || 1),
            pickupMethod: pickupMethod as any,
            deliveryAddressLine1: pickupMethod === 'DELIVERY' ? toString(da?.addressLine1) || null : null,
            deliveryAddressLine2: pickupMethod === 'DELIVERY' ? toString(da?.addressLine2) || null : null,
            deliveryCity: pickupMethod === 'DELIVERY' ? toString(da?.city) || null : null,
            deliveryProvince: pickupMethod === 'DELIVERY' ? toString(da?.province) || null : null,
            deliveryPostalCode: pickupMethod === 'DELIVERY' ? toString(da?.postalCode) || null : null,
            deliveryCountry: pickupMethod === 'DELIVERY' ? toString(da?.country) || null : null,
            note: toString(r?.note) || null,
            status: 'REQUESTED',
          },
        });
      }
    }

    const buyer = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    const buyerName = buyer?.name || buyer?.email || 'Pembeli';
    const buyerEmail = buyer?.email || '';

    const purchasedCourseIds = Array.from(new Set(created.items.map((it) => it.courseId).filter(Boolean))) as string[];
    const courseTitlesByMentor = new Map<string, Set<string>>();

    for (const it of created.items) {
      if (!it.courseId || !it.course) continue;
      const instructorId = String((it.course as any).instructorId || '');
      if (!instructorId) continue;
      const set = courseTitlesByMentor.get(instructorId) ?? new Set<string>();
      set.add(String((it.course as any).title || it.courseId));
      courseTitlesByMentor.set(instructorId, set);
    }

    if (purchasedCourseIds.length > 0) {
      const co = await tx.courseCoInstructor.findMany({
        where: { courseId: { in: purchasedCourseIds } },
        select: { courseId: true, userId: true },
      });
      const titleById = new Map<string, string>();
      for (const it of created.items) {
        if (!it.courseId || !it.course) continue;
        titleById.set(String(it.courseId), String((it.course as any).title || it.courseId));
      }
      for (const rel of co) {
        const title = titleById.get(String(rel.courseId));
        if (!title) continue;
        const set = courseTitlesByMentor.get(String(rel.userId)) ?? new Set<string>();
        set.add(title);
        courseTitlesByMentor.set(String(rel.userId), set);
      }
    }

    if (courseTitlesByMentor.size > 0) {
      const href = '/dashboard/mentor/sales/orders';
      await tx.notification.createMany({
        data: Array.from(courseTitlesByMentor.entries()).map(([mentorId, titlesSet]) => ({
          userId: mentorId,
          title: 'Pesanan Kursus Baru',
          message: [
            `Pembeli: ${buyerName}${buyerEmail ? ` (${buyerEmail})` : ''}`,
            `Kursus: ${Array.from(titlesSet.values()).join(', ')}`,
            `Order: ${created.id}`,
            'Status: MENUNGGU PEMBAYARAN',
            `LINK:${href}`,
          ].join('\n'),
          read: false,
        })),
      });
    }

    const purchasedVendorIds = Array.from(
      new Set(created.items.map((it) => it.product?.vendorId).filter((v) => typeof v === 'string' && v.trim()))
    ) as string[];
    if (purchasedVendorIds.length > 0) {
      const vendors = await tx.shopVendor.findMany({
        where: { id: { in: purchasedVendorIds } },
        select: { id: true, name: true, ownerId: true, members: { select: { userId: true } } },
      });
      const vendorById = new Map(vendors.map((v) => [v.id, v] as const));
      const byRecipient = new Map<string, Map<string, Set<string>>>();

      for (const it of created.items) {
        const vendorId = it.product?.vendorId;
        if (!vendorId) continue;
        const vendor = vendorById.get(vendorId);
        if (!vendor) continue;
        const productName = it.product?.name || it.productId || '';
        if (!productName) continue;

        const recipients = new Set<string>();
        if (vendor.ownerId) recipients.add(String(vendor.ownerId));
        for (const m of vendor.members) recipients.add(String(m.userId));

        for (const rid of recipients) {
          const vm = byRecipient.get(rid) ?? new Map<string, Set<string>>();
          const set = vm.get(vendorId) ?? new Set<string>();
          set.add(productName);
          vm.set(vendorId, set);
          byRecipient.set(rid, vm);
        }
      }

      if (byRecipient.size > 0) {
        const href = '/dashboard/mentor/sales/orders';
        const notifications = Array.from(byRecipient.entries()).flatMap(([rid, vendorMap]) => {
          return Array.from(vendorMap.entries()).map(([vendorId, namesSet]) => {
            const vendor = vendorById.get(vendorId);
            return {
              userId: rid,
              title: 'Pesanan Produk Baru',
              message: [
                `Pembeli: ${buyerName}${buyerEmail ? ` (${buyerEmail})` : ''}`,
                vendor?.name ? `Vendor: ${vendor.name}` : '',
                `Produk: ${Array.from(namesSet.values()).join(', ')}`,
                `Order: ${created.id}`,
                'Status: MENUNGGU PEMBAYARAN',
                `LINK:${href}`,
              ]
                .filter(Boolean)
                .join('\n'),
              read: false,
            };
          });
        });
        await tx.notification.createMany({ data: notifications });
      }
    }

    return created;
  });

  return order;
};

export const getOrders = async (userId?: string) => {
  return prisma.order.findMany({
    where: userId ? { userId } : {},
    include: {
      user: {
        select: { name: true, email: true },
      },
      items: {
        include: {
          product: true,
          course: true,
          serviceBooking: true,
          rentalReservation: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const updateOrderStatus = async (id: string, status: OrderStatus) => {
  return prisma.order.update({
    where: { id },
    data: { status },
  });
};
