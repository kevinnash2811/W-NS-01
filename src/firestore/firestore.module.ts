import { Module }           from '@nestjs/common';
import { FirestoreService } from 'src/firestore/firestore.service';

@Module({
  providers: [FirestoreService],
  exports: [FirestoreService],
})
export class FirestoreModule {}