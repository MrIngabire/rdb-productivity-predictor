from django.core.management.base import BaseCommand

from productivity import ml_engine
from productivity.models import EngineSettings


class Command(BaseCommand):
    help = "Train the Random Forest productivity model using the configured engine parameters."

    def handle(self, *args, **options):
        cfg = EngineSettings.load()
        meta = ml_engine.train_and_save(cfg.pass_threshold, cfg.n_estimators, cfg.max_depth)
        self.stdout.write(self.style.SUCCESS(
            f"Model saved. accuracy={meta['accuracy']:.1%} MAE={meta['mae']} R2={meta['r2']}"
        ))
