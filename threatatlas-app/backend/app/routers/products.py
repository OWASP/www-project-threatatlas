from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product as ProductModel, User as UserModel
from app.models.enums import UserRole
from app.schemas import Product, ProductCreate, ProductUpdate
from app.auth.dependencies import get_current_user
from app.auth.permissions import require_standard_or_admin, can_access_product, can_edit_product, PermissionDenied

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[Product])
def list_products(
    current_user: UserModel = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    List products.

    Admin users see all products.
    Standard and read-only users see their own products and products they collaborate on.
    """
    from sqlalchemy import or_
    from app.models import ProductCollaborator

    query = db.query(ProductModel)

    # Admins see all products
    # Others see products they own or collaborate on
    if current_user.role != UserRole.ADMIN.value:
        query = query.outerjoin(ProductCollaborator).filter(
            or_(
                ProductModel.user_id == current_user.id,
                ProductCollaborator.user_id == current_user.id,
                ProductModel.is_public == True
            )
        ).distinct()

    products = query.offset(skip).limit(limit).all()
    return products


@router.get("/{product_id}", response_model=Product)
def get_product(
    product_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a product by ID.

    Admin users can access any product.
    Other users can access their own products and products they collaborate on.
    """
    from sqlalchemy.orm import joinedload

    product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Check access (owner, collaborator, or admin)
    if not can_access_product(current_user, product):
        raise PermissionDenied("Not authorized to access this product")

    return product


@router.post("/", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(
    product: ProductCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new product.

    Requires standard or admin role (read-only users cannot create).
    """
    require_standard_or_admin(current_user)

    db_product = ProductModel(
        **product.model_dump(),
        user_id=current_user.id
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.put("/{product_id}", response_model=Product)
def update_product(
    product_id: int,
    product: ProductUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update a product.

    Admin users can update any product.
    Product owners and editor/owner collaborators can update.
    """
    from sqlalchemy.orm import joinedload

    db_product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Check edit permission (owner, editor/owner collaborator, or admin)
    if not can_edit_product(current_user, db_product):
        raise PermissionDenied("Not authorized to edit this product")

    update_data = product.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_product, field, value)

    db.commit()
    db.refresh(db_product)
    return db_product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a product.

    Only product owner or admin can delete products.
    Collaborators cannot delete, even with owner role.
    """
    from sqlalchemy.orm import joinedload

    db_product = db.query(ProductModel).options(
        joinedload(ProductModel.collaborators)
    ).filter(ProductModel.id == product_id).first()

    if not db_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )

    # Only product owner or admin can delete
    if current_user.role != UserRole.ADMIN.value and db_product.user_id != current_user.id:
        raise PermissionDenied("Only product owner can delete products")

    db.delete(db_product)
    db.commit()
    return None
