from torchvision import transforms

def build_train_transform(size=224):
    return transforms.Compose([
        transforms.Resize((size, size)),
        transforms.RandomAffine(degrees=5, translate=(0.02, 0.02), scale=(0.97, 1.03)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

def build_eval_transform(size=224):
    return transforms.Compose([
        transforms.Resize((size, size)), transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
